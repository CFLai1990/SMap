define([
  '../elements/index',
  '../polygons/index',
  'exportClassFromAMD'
], function (GeoElements, GeoPolygons, ExportClass) {
  class SubCluster {
    constructor (dcdID, subTree, anchor, levelOThis, gridType, cellRadius, polygonCreator) {
      this.ID = dcdID
      this.subTree = subTree
      this.path2This = subTree.index // including the its own dcdID
      this.level = levelOThis
      this.isTopChild = (this.level === 1)
      this.center = anchor
      this.gridType = gridType
      this.cellRadius = cellRadius
      this.polygonCreator = polygonCreator
      this.numberODCD = subTree.dictionary.length
      this.glbTraversalOrder = subTree.data.glbTraversalOrder
      this.allLeaves = new Map() // leafName - node
      this.altitude
      this.contour
      this.occupied = new Map() // position ('i_j') - leafName
      this.neighbors = new Set() // position ('i_j')
      this.initialize()
    } // end of constructor of SubCluster

    initialize () {
            // layout the center
      if (this.isTopChild) {
        this.centerLeafName = this.subTree.data.centerLeafName[0]
        this.center.ID = this.centerLeafName // update the center
        this.layoutLeaf(this.centerLeafName, this.center)
      }
    } // end of initialize

        // layout one leaf
    layoutLeaf (leafName, leafNode) {
      let leafPosition = leafNode.position.i + '_' + leafNode.position.j
      this.allLeaves.set(leafName, leafNode) // update allLeaves
      this.occupied.set(leafPosition, leafName) // update the occupied list
      this.neighbors.delete(leafPosition)
      for (let neighbor of leafNode.neighbors) {
        let nghPosition = neighbor[1] // [nghAngle, nghPosition]
        let nghPositionInStore = nghPosition[0] + '_' + nghPosition[1]
        if (!this.occupied.has(nghPositionInStore)) {
          this.neighbors.add(nghPositionInStore)
        }
      }
    } // end of layoutLeaf

    getAltPositions (existingList, forbiddenList, alternativeList) {
      for (let neighbor of this.neighbors) {
        if (!existingList.has(neighbor) && !forbiddenList.has(neighbor)) {
          alternativeList.add(neighbor)
        }
      }
    } // end of getAltPositions

    getAltWeights (distMatrix, existingList, thisLeaf, weights) {
      let weightFunc = (dist) => {
        return 1 / (dist * dist)
      }
            // weights of the siblings (leafs in the same subtree)
      for (let leafPosition of this.occupied) {
        let distance = distMatrix[thisLeaf][leafPosition[1]]
        weights.set(leafPosition[0], weightFunc(distance))
      }
            // weights of the others (existing list)
      for (let leafPosition of existingList) {
        let distance = distMatrix[thisLeaf][leafPosition[1]]
        weights.set(leafPosition[0], weightFunc(distance))
      }
    } // end of getAltWeights

    getLeafPosition (alternativeList, weights) {
      let scoreFunc = (thisCoords, thatCoords, weight) => {
        let distX = thisCoords[0] - thatCoords[0]
        let distY = thisCoords[1] - thatCoords[1]
        let distance = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2))
        let angle = distX === 0 ? (Math.PI / 2) : Math.atan(distY / distX)
        let scoreValue = weight / (distance * distance)
        return [scoreValue * Math.cos(angle), scoreValue * Math.sin(angle)]
      }
      let maxScore = -Infinity
      let leafPosition
      for (let position of alternativeList) {
        let thisPosition = position.split('_')
        let thisCoords = this.center.getCoordinatesByPosition(this.cellRadius, thisPosition)
        let score = [0, 0]
        for (let p2w of weights) {
          let thatPosition = p2w[0].split('_')
          let thatCoords = this.center.getCoordinatesByPosition(this.cellRadius, thatPosition)
          let thatScore = scoreFunc(thisCoords, thatCoords, p2w[1])
          score = [score[0] + thatScore[0], score[1] + thatScore[1]] // add up the forces
        }
        let scoreValue = Math.sqrt(score[0] * score[0] + score[1] * score[1])
        if (scoreValue > maxScore) {
          maxScore = scoreValue
          leafPosition = thisPosition
        }
      }
      return [parseInt(leafPosition[0]), parseInt(leafPosition[1])]
    } // end of getLeafPosition

    layoutAll (distMatrix, existingList, forbiddenList) {
      for (let traversalOrder = 0; traversalOrder < this.numberODCD; traversalOrder++) {
        let leafName = this.glbTraversalOrder[traversalOrder] // the alternative leaf
        if (leafName === this.centerLeafName) {
          continue
        }
        let alternativeList = new Set() // alternatives - position
        this.getAltPositions(existingList, forbiddenList, alternativeList)
        let weights = new Map() // position - leaf2leafWeights
        this.getAltWeights(distMatrix, existingList, leafName, weights)
        let leafPosition = this.getLeafPosition(alternativeList, weights)
        if (isNaN(leafPosition[0]) || isNaN(leafPosition[1])) {
          console.error('top tree: ' + this.ID + ' - leaf: ' + leafName)
        }
        let leafNode = this.polygonCreator(leafName, this.cellRadius, leafPosition)
        this.layoutLeaf(leafName, leafNode)
      }
    } // end of layoutAll
    } // end of class SubCluster

  class SubmapLayout {
    constructor (subTree, distMatrix, subCodes, gridType, gridScaling) {
      this.subTree = subTree // references to the parameters, not new variables
      this.path2This = subTree.index
      this.distMatrix = distMatrix
      this.codes = subCodes
      this.cellRadius = 1
      let polygonCreator
      switch (gridType) {
        case 'hexagon':
          polygonCreator = GeoPolygons.Hexagon
          break
      }
      this.polygon = polygonCreator('core', this.cellRadius, [0, 0])
      this.polygonCreator = polygonCreator
      this.numberOChildren = subTree.children.length
      this.numberOLeaves = subTree.leaves.length
      this.numberODCD = subTree.dictionary.length // DCD:   all leaves
      this.numberOAnchors = subTree.data.initProjection.length
      this.gridScaling = gridScaling
      this.allLeaves = new Map() // leafName - node
      this.descendants = new Map() // prefix ('child_' or 'leaf_') + childCID / leafName - node
      this.dcdTraversalOrder = this.subTree.data.dcdTraversalOrder
    } // end of constructor of SubmapLayout

    getMap () {
      this.layoutAnchors()
      this.layoutAll()
    } // end of getMap

    layoutAnchors () {
      let initProjection = this.subTree.data.initProjection
      let gridRadius = Math.round(this.numberODCD * this.gridScaling / 2) // gridRadius: the amount of grids in one direction
      let gridRange = { x: { min: -gridRadius, max: gridRadius }, y: { min: -gridRadius, max: gridRadius } }
      let extrema = { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } }
      for (let anchorID = 0; anchorID < this.numberOAnchors; anchorID++) {
        let anchor = initProjection[anchorID]
        if (anchor[0] < extrema.x.min) { extrema.x.min = anchor[0] }
        if (anchor[0] > extrema.x.max) { extrema.x.max = anchor[0] }
        if (anchor[1] < extrema.y.min) { extrema.y.min = anchor[1] }
        if (anchor[1] > extrema.y.max) { extrema.y.max = anchor[1] }
      }
            // the order in dcdDistMatrix:    [children, leaves], which does not follow  the dcdTraversalOrder
      for (let anchorID = 0; anchorID < this.numberOAnchors; anchorID++) {
                // Step 1:   transform the projection coordinates into grid coordinates
        let originalCoords = initProjection[anchorID]
        let newCoords = []
        newCoords[0] = (originalCoords[0] - extrema.x.min) / (extrema.x.max - extrema.x.min) * (gridRange.x.max - gridRange.x.min) + gridRange.x.min
        newCoords[1] = (originalCoords[1] - extrema.y.min) / (extrema.y.max - extrema.y.min) * (gridRange.y.max - gridRange.y.min) + gridRange.y.min
        newCoords[0] = newCoords[0] * 2 * this.cellRadius
        newCoords[1] = newCoords[1] * 2 * this.cellRadius
                // Step 2:   transform the grid coordinates into integer positions
        let anchorPosition = this.polygon.getPositionByCoordinates(this.cellRadius, newCoords)
                // Step 3:   see if the anchor represents a child
        let isChild = anchorID < this.numberOChildren
        let anchorName
        let anchor
        if (isChild) {
                    // is a child, then create a SubCluster
          let childCID = anchorID
          anchorName = 'child_' + childCID
          anchor = this.polygonCreator(childCID, this.cellRadius, anchorPosition)
          let subClusterNode = new SubCluster(childCID, this.subTree.children[childCID], anchor, 1, this.gridType, this.cellRadius, this.polygonCreator)
          this.descendants.set(anchorName, subClusterNode)
        } else {
                    // not a child, then put in the anchor
          let leafID = anchorID - this.numberOChildren
          let leafName = this.subTree.leaves[leafID]
          anchorName = 'leaf_' + leafName
          anchor = this.polygonCreator(leafName, this.cellRadius, anchorPosition)
          this.descendants.set(anchorName, anchor)
          this.allLeaves.set(leafName, anchor)
        }
      }
    } // end of layoutAnchors

    layoutAll () {
            // the layout process needs  to follow the dcdTraversalOrder
      for (let traversalOrder = 0; traversalOrder < this.dcdTraversalOrder.length; traversalOrder++) {
        let dcdInfo = this.dcdTraversalOrder[traversalOrder]
        if (dcdInfo[1] === -1) { // this is a direct leaf
          continue
        } else { // this is a child
          let childCID = dcdInfo[0]
          let childCluster = this.descendants.get('child_' + childCID)
                    // Step 1:   get the forbidden list and the existing list
          let [existingList, forbiddenList] = this.prepare4Layout(childCID)
                    // Step 2:   layout for this cluster
          childCluster.layoutAll(this.distMatrix, existingList, forbiddenList)
          this.allLeaves = new Map([...this.allLeaves, ...childCluster.allLeaves])
        }
      }
    } // end of layoutAll

    prepare4Layout (childCID) {
      let extList = new Map() // Map:   position - leafName
      let fbdList = new Set() // Set:   position:   'i_j'
      for (let traversalOrder = 0; traversalOrder < this.dcdTraversalOrder.length; traversalOrder++) {
        let dcdInfo = this.dcdTraversalOrder[traversalOrder]
        if (dcdInfo[1] === -1) { // this is a direct leaf
                    // put in the descendant itself
          let descendant = this.descendants.get('leaf_' + dcdInfo[0])
          extList.set(descendant.position.i + '_' + descendant.position.j, dcdInfo[0])
                    // put in the neighbors
          let neighbors = descendant.neighbors // this is a map
          for (let neighbor of neighbors) {
            fbdList.add(neighbor[1].join('_'))
          }
        } else { // this is a child
          if (dcdInfo[0] !== childCID) { // not itself
                        // put in the descendant itself
            let descendant = this.descendants.get('child_' + dcdInfo[0])
            extList = new Map([...extList, ...descendant.occupied])
                        // put in the neighbors
            let neighbors = descendant.neighbors // this is a set
            fbdList = new Set([...fbdList, ...neighbors])
          }
        }
      }
      return [extList, fbdList]
    } // end of prepare4Layout
    } // end of class SubmapLayout

  return ExportClass(SubmapLayout)
})
