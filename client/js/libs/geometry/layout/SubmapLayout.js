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
      this.cellRadius = 1
      this.centerLeafName
      this.gridType = gridType
      this.codes = subCodes
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
      this.occupied = new Map() //  position ('i_j') - leafName
      this.descendants = new Map() // prefix ('child_' or 'leaf_') + childCID / leafName - node
      this.dcdTraversalOrder = this.subTree.data.dcdTraversalOrder
    } // end of constructor of SubmapLayout

    getMap () {
      this.layoutAnchors()
      this.layoutAll()
      this.summarize()
    } // end of getMap

    layoutAnchors () {
      let initProjection = this.subTree.data.initProjection
      let gridRadius = Math.round(Math.sqrt(this.numberODCD * this.gridScaling)) // gridRadius: the amount of grids in one direction
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
      let centerInfo = this.dcdTraversalOrder[0]
      let anchorOccupied = new Set()
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
        let positionID = anchorPosition.join('_')
        if (!anchorOccupied.has(positionID)) {
          // not occupied, than use it
          anchorOccupied.add(positionID)
        } else {
          // occupied, than assign a new position
          let node = this.polygonCreator('try', this.cellRadius, anchorPosition)
          let existingList = new Map([[positionID, node]])
          let foundMatch = false
          while (!foundMatch) {
            let newExistingList = new Map()
            for (let existingNode of existingList) {
              for (let neighbor of existingNode[1].neighbors) {
                let nghPositionID = neighbor[1].join('_')
                if (!anchorOccupied.has(nghPositionID)) {
                  // not occupied, than use it
                  anchorPosition = neighbor[1]
                  positionID = nghPositionID
                  foundMatch = true
                  break
                } else {
                  if (!newExistingList.has(nghPositionID)) {
                    let nghNode = this.polygonCreator('try', this.cellRadius, neighbor[1])
                    newExistingList.set(nghPositionID, nghNode)
                  }
                }
              }
              if (foundMatch) { break }
            }
            if (!foundMatch) { // all neighbors have been used
              existingList = newExistingList
            }
          }
          anchorOccupied.add(positionID)
        }

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
          // get the centerLeafName
          if (centerInfo[1] === 0 && centerInfo[0] === childCID) {
            this.centerLeafName = subClusterNode.centerLeafName
          }
        } else {
          // not a child, then put in the anchor
          let leafID = anchorID - this.numberOChildren
          let leafName = this.subTree.leaves[leafID]
          anchorName = 'leaf_' + leafName
          anchor = this.polygonCreator(leafName, this.cellRadius, anchorPosition)
          this.descendants.set(anchorName, anchor)
          this.allLeaves.set(leafName, anchor)
          this.occupied.set(anchor.position.i + '_' + anchor.position.j, leafName)
          if (centerInfo[1] === -1 && centerInfo[0] === leafName) {
            this.centerLeafName = leafName
          }
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
          this.occupied = new Map([...this.occupied, ...childCluster.occupied])
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

    summarize () {
      // Step 1:   prepare the factors
      let xFactor
      let yFactor
      switch (this.gridType) {
        case 'hexagon':
          xFactor = 1
          yFactor = 2 * Math.sqrt(3) / 3
          break
      }
      // Step 2:   get the range of coordinates
      let extCoords = { x: { min: Infinity, max: -Infinity }, y: { min: Infinity, max: -Infinity } }
      for (let leaf of this.allLeaves) {
        let leafCoords = leaf[1].center.coordinates
        extCoords.x.max = Math.max(leafCoords.x, extCoords.x.max)
        extCoords.x.min = Math.min(leafCoords.x, extCoords.x.min)
        extCoords.y.max = Math.max(leafCoords.y, extCoords.y.max)
        extCoords.y.min = Math.min(leafCoords.y, extCoords.y.min)
      }
      extCoords.x.max = extCoords.x.max + 3 * this.cellRadius * xFactor
      extCoords.x.min = extCoords.x.min - 3 * this.cellRadius * xFactor
      extCoords.y.max = extCoords.y.max + 3 * this.cellRadius * yFactor
      extCoords.y.min = extCoords.y.min - 3 * this.cellRadius * yFactor
      extCoords.aspectRatio = (extCoords.y.max - extCoords.y.min) / (extCoords.x.max - extCoords.x.min)
      // Step 3:   get the range of integer positions
      let extPosition = { i: { min: Infinity, max: -Infinity }, j: { min: Infinity, max: -Infinity } }
      for (let leaf of this.allLeaves) {
        let leafPosition = leaf[1].position
        extPosition.i.max = Math.max(leafPosition.i, extPosition.i.max)
        extPosition.i.min = Math.min(leafPosition.i, extPosition.i.min)
        extPosition.j.max = Math.max(leafPosition.j, extPosition.j.max)
        extPosition.j.min = Math.min(leafPosition.j, extPosition.j.min)
      }
      extPosition.i.max = extPosition.i.max + 1
      extPosition.i.min = extPosition.i.min - 1
      extPosition.j.max = extPosition.j.max + 1
      extPosition.j.min = extPosition.j.min - 1
      this.coordsRange = extCoords
      this.positionRange = extPosition
    } // end of summarize

    getClusterContours (clusters) {
      let clusterContours = []
      for (let clusterID = 0; clusterID < clusters.length; clusterID++) {
        // construct the contour of each cluster
        let contour = { paths: null, lines: null }
        let cluster = clusters[clusterID]
        let nonRepeatEdges = new Map()
        // Step 1:   get the non-repeat edges
        for (let leafName of cluster) {
          // get the leaf
          let leafNode = this.allLeaves.get(leafName)
          // examine its edges
          for (let leafEdgeEntry of leafNode.edges) {
            let edge = leafEdgeEntry[1]
            let edgePosition = edge.nghPositions
            if (!nonRepeatEdges.has(edgePosition)) {
              nonRepeatEdges.set(edgePosition, edge)
            } else {
              nonRepeatEdges.delete(edgePosition)
            }
          }
        }
        let contourEdges = []
        for (let edge of nonRepeatEdges) {
          contourEdges.push(edge[1])
        }
        contour.lines = contourEdges
        // Step 2:   get the contours
        contour.paths = GeoElements.Methods.getPathsByEdges(contourEdges)
        clusterContours[clusterID] = contour
      }
      return clusterContours
    } // end of getClusterContours
  } // end of class SubmapLayout

  return ExportClass(SubmapLayout)
})
