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

    updateRecords (leafName, leafNode) {
      let leafPosition = leafNode.position.i + '_' + leafNode.position.j
      this.occupied.set(leafPosition, leafName) // update the occupied list
      this.neighbors.delete(leafPosition)
      for (let neighbor of leafNode.neighbors) {
        let nghPosition = neighbor[1] // [nghAngle, nghPosition]
        let nghPositionInStore = nghPosition[0] + '_' + nghPosition[1]
        if (!this.occupied.has(nghPositionInStore)) {
          this.neighbors.add(nghPositionInStore)
        }
      }
    } // end of updateRecords

    // layout one leaf
    layoutLeaf (leafName, leafNode) {
      this.allLeaves.set(leafName, leafNode) // update allLeaves
      this.updateRecords(leafName, leafNode)
    } // end of layoutLeaf

    move (moveVector) {
      this.occupied.clear()
      this.neighbors.clear()
      for (let leaf of this.allLeaves) {
        leaf[1].move(moveVector)
        this.updateRecords(leaf[0], leaf[1])
      }
      return this.occupied
    } // end of move

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
      this.centerLeafName = null
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
      this.seamCarving()
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
          // sparse anchors:   block the neighbors of the occupied cell
          let node = this.polygonCreator('try', this.cellRadius, anchorPosition)
          for (let neighbor of node.neighbors) {
            let nghPositionID = neighbor[1].join('_')
            anchorOccupied.add(nghPositionID)
          }
        } else {
          // occupied, than assign a new position
          let node = this.polygonCreator('try', this.cellRadius, anchorPosition)
          let existingList = new Map([
            [positionID, node]
          ])
          // find a new position
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
          // sparse anchors:   block the neighbors of the occupied cell
          node = this.polygonCreator('try', this.cellRadius, anchorPosition)
          for (let neighbor of node.neighbors) {
            let nghPositionID = neighbor[1].join('_')
            anchorOccupied.add(nghPositionID)
          }
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
      this.coordsRange = extCoords
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
      this.positionRange = extPosition
    } // end of summarize

    moveDescendants (moveVectors) {
      this.occupied.clear()
      for (let dcdMoveVector of moveVectors) {
        let dcdID = dcdMoveVector[0]
        let vector = dcdMoveVector[1]
        if (dcdID.includes('leaf')) {
          let leafName = parseInt(dcdID.replace('leaf_', ''))
          let leafNode = this.descendants.get(dcdID)
          leafNode.move(vector)
          let leafPosition = leafNode.position.i + '_' + leafNode.position.j
          this.occupied.set(leafPosition, leafName)
        } else {
          let newOccupied = this.descendants.get(dcdID).move(vector)
          this.occupied = new Map([...this.occupied, ...newOccupied])
        }
      }
    } // end of moveDescendants

    seamCarving () {
      // Step 1:   rough carve
      this.roughCarving()
      // Step 2:   fine carve
      this.moveBasedOnDistance = true
      this.fineCarving()
    } // end of seamCarving

    fineCarving () {
      let moveVectors = this.getFineCarvingVectors()
      this.moveDescendants(moveVectors)
      this.summarize()
    } // end of fineCarving

    getFineCarvingVectors () {
      // Step 1:   prepare the ranges, the center and the cell energies
      let carveNode = this.polygonCreator('carve', this.cellRadius, [0, 0])
      let cellEnergy = new Map()
      let cellsODCD = new Map()
      let overallRange = []
      let moveVectors = new Map()
      // Step 1-1:   the ranges and the energies
      for (let dcdInfo of this.dcdTraversalOrder) {
        if (dcdInfo[1] === -1) { // this is a direct leaf
          let leafName = dcdInfo[0]
          let ID = 'leaf_' + leafName
          moveVectors.set(ID, [0, 0])
          let leafNode = this.descendants.get(ID)
          let leafPosition = carveNode.changePosition([leafNode.position.i, leafNode.position.j])
          let allCells = []
          // set the energies for the leaf nodes
          cellEnergy.set(leafPosition.join('_'), Infinity)
          allCells.push(leafPosition)
          // get the range
          let range = carveNode.getPositionRange(allCells)
          overallRange = [...overallRange, ...range]
          // set the energies for the neighbors
          for (let neighbor of leafNode.neighbors) { // this is a map
            let neighborPosition = carveNode.changePosition(neighbor[1])
            cellEnergy.set(neighborPosition.join('_'), Infinity)
            allCells.push(neighborPosition)
          }
          cellsODCD.set(ID, allCells)
        } else { // this is a child
          let childCID = dcdInfo[0]
          let ID = 'child_' + childCID
          moveVectors.set(ID, [0, 0])
          let childCluster = this.descendants.get(ID)
          let allCells = []
          for (let leaf of childCluster.allLeaves) {
            let leafPosition = carveNode.changePosition([leaf[1].position.i, leaf[1].position.j])
            // set the energies for the leaf nodes
            cellEnergy.set(leafPosition.join('_'), Infinity)
            allCells.push(leafPosition)
          }
          // get the range
          let range = carveNode.getPositionRange(allCells)
          overallRange = [...overallRange, ...range]
          // set the energies for the neighbors
          let neighbors = childCluster.neighbors
          for (let neighbor of neighbors) { // this is a set
            let neighborPosition = carveNode.changePosition(neighbor.split('_'))
            cellEnergy.set(neighborPosition.join('_'), Infinity)
            allCells.push(neighborPosition)
          }
          cellsODCD.set(ID, allCells)
        }
      }
      overallRange = carveNode.getPositionRange(overallRange)
      // set the energies
      for (let row = overallRange[0][1]; row <= overallRange[1][1]; row++) {
        for (let column = overallRange[0][0]; column <= overallRange[1][0]; column++) {
          let positionID = column + '_' + row
          if (!cellEnergy.has(positionID)) {
            cellEnergy.set(positionID, 0)
          }
        }
      }
      // get the center
      let centerPosition = {
        i: Math.round((overallRange[0][0] + overallRange[1][0]) / 2),
        j: Math.round((overallRange[0][1] + overallRange[1][1]) / 2)
      }
      this.centerPosition = centerPosition
      // Step 1-2:   get the directions
      let moveOrders = []
      let moveDirections = new Map()
      for (let dcdInfo of this.dcdTraversalOrder) {
        if (dcdInfo[1] === -1) { // this is a direct leaf
          let leafName = dcdInfo[0]
          let ID = 'leaf_' + leafName
          let leafPosition = cellsODCD.get(ID)[0]
          let direction = [centerPosition.i - leafPosition[0], centerPosition.j - leafPosition[1]]
          moveDirections.set(ID, direction)
        } else { // this is a child
          let childCID = dcdInfo[0]
          let ID = 'child_' + childCID
          let childCluster = this.descendants.get(ID)
          let direction = [0, 0]
          let distance = Infinity
          let directionUpdated = [false, false]
          let dontMove = [false, false]
          for (let leaf of childCluster.allLeaves) {
            let leafPosition = carveNode.changePosition([leaf[1].position.i, leaf[1].position.j])
            let directionOLeaf = [centerPosition.i - leafPosition[0], centerPosition.j - leafPosition[1]]
            if (!directionUpdated[0]) {
              direction[0] = directionOLeaf[0]
              directionUpdated[0] = true
            } else {
              if (!dontMove[0] && direction[0] * directionOLeaf[0] <= 0) { // across the center, doesn't need to move
                dontMove[0] = true
                direction[0] = 0
              }
            }
            if (!directionUpdated[1]) {
              direction[1] = directionOLeaf[1]
              directionUpdated[1] = true
            } else {
              if (!dontMove[1] && direction[1] * directionOLeaf[1] <= 0) { // across the center, doesn't need to move
                dontMove[1] = true
                direction[1] = 0
              }
            }
            if (dontMove[0] && dontMove[1]) {
              distance = Infinity
            } else {
              let distanceOLeaf = Math.pow(directionOLeaf[0], 2) + Math.pow(directionOLeaf[1], 2)
              if (distanceOLeaf < distance) {
                distance = distanceOLeaf
              }
              if (!dontMove[0]) {
                direction[0] = directionOLeaf[0]
              }
              if (!dontMove[1]) {
                direction[1] = directionOLeaf[1]
              }
            }
          }
          moveDirections.set(ID, direction)
          moveOrders.push([ID, distance])
        }
      }
      // pack the leaves
      let leafCells = []
      let directionUpdated = [false, false]
      let leafDirection = [0, 0]
      let leafDistance = Infinity
      for (let dcd of cellsODCD) {
        let leafID = dcd[0]
        if (leafID.includes('child')) {
          continue
        }
        leafCells = [...leafCells, ...dcd[1]]
        cellsODCD.delete(leafID)
        let directionOLeaf = moveDirections.get(leafID)
        moveDirections.delete(leafID)
        if (!directionUpdated[0]) {
          leafDirection[0] = directionOLeaf[0]
          directionUpdated[0] = true
        } else {
          if (leafDirection[0] * directionOLeaf[0] <= 0) { // across the center, doesn't need to move
            leafDirection[0] = 0
          }
        }
        if (!directionUpdated[1]) {
          leafDirection[1] = directionOLeaf[1]
          directionUpdated[1] = true
        } else {
          if (leafDirection[1] * directionOLeaf[1] <= 0) { // across the center, doesn't need to move
            leafDirection[1] = 0
          }
        }
        if (!(leafDirection[0] === 0 && leafDirection[1] === 0)) {
          let distanceOLeaf = Math.pow(directionOLeaf[0], 2) + Math.pow(directionOLeaf[1], 2)
          leafDistance = Math.min(leafDistance, distanceOLeaf)
        }
      }
      cellsODCD.set('leaves', leafCells)
      moveDirections.set('leaves', leafDirection)
      moveOrders.push(['leaves', leafDistance])
      moveOrders.sort(function (a, b) { return a[1] > b[1] })
      // block the center
      // cellEnergy.set(centerPosition.i + '_' + centerPosition.j, Infinity)
      // Step 2:   try to move the cells
      if (this.moveBasedOnDistance) {
        for (let order of moveOrders) {
          let ID = order[0]
          let vector = this.tryToMove(cellEnergy, cellsODCD.get(ID), moveDirections.get(ID))
          if (ID === 'leaves') {
            for (let dcdInfo of this.dcdTraversalOrder) {
              if (dcdInfo[1] === -1) {
                moveVectors.set('leaf_' + dcdInfo[0], vector)
              }
            }
          } else {
            moveVectors.set(ID, vector)
          }
        }
      } else {
        // first move the children
        for (let dcdInfo of this.dcdTraversalOrder) {
          if (dcdInfo[1] !== -1) { // this is a child
            let ID = 'child_' + dcdInfo[0]
            let vector = this.tryToMove(cellEnergy, cellsODCD.get(ID), moveDirections.get(ID))
            moveVectors.set(ID, vector)
          }
        }
        // then move the leaves
        let vector = this.tryToMove(cellEnergy, cellsODCD.get('leaves'), moveDirections.get('leaves'))
        for (let dcdInfo of this.dcdTraversalOrder) {
          if (dcdInfo[1] === -1) { // this is a direct leaf
            moveVectors.set('leaf_' + dcdInfo[0], vector)
          }
        }
      }
      return moveVectors
    } // end of getFineCarvingVectors

    tryToMove (cellEnergy, cells, direction) {
      // Step 1:   clear its own energies
      for (let cell of cells) {
        cellEnergy.set(cell.join('_'), 0)
      }
      // Step 2:   try to move
      let moveValues = [0, 0]
      let moveDistance = 0
      let failed = false
      if (!(direction[0] === 0 && direction[1] === 0)) {
        let directionDistance = Math.sqrt(Math.pow(direction[0], 2) + Math.pow(direction[1], 2))
        while (!failed) {
          moveDistance++
          moveValues[0] = Math.round(moveDistance / directionDistance * direction[0])
          moveValues[1] = Math.round(moveDistance / directionDistance * direction[1])
          // try the new positions
          for (let cell of cells) {
            let newCell = []
            newCell[0] = cell[0] + moveValues[0]
            newCell[1] = cell[1] + moveValues[1]
            if (cellEnergy.get(newCell.join('_')) !== 0) {
              failed = true
              moveDistance--
              moveValues[0] = Math.round(moveDistance / directionDistance * direction[0])
              moveValues[1] = Math.round(moveDistance / directionDistance * direction[1])
              break
            }
          }
        }
      }
      // Step 3:   update the energies
      for (let cell of cells) {
        let newCell = []
        newCell[0] = cell[0] + moveValues[0]
        newCell[1] = cell[1] + moveValues[1]
        cellEnergy.set(newCell.join('_'), Infinity)
      }
      return moveValues
    } // end of tryToMove

    roughCarving () {
      let moveVectors = this.getRoughCarvingVectors()
      this.moveDescendants(moveVectors)
      this.summarize()
    } // end of roughCarving

    getRoughCarvingVectors () {
      // Step 1:   prepare the ranges and the center
      let carveNode = this.polygonCreator('carve', this.cellRadius, [0, 0])
      let overallRange = []
      let rangeSegments = new Map()
      let moveVectors = new Map()
      for (let traversalOrder = 0; traversalOrder < this.dcdTraversalOrder.length; traversalOrder++) {
        let dcdInfo = this.dcdTraversalOrder[traversalOrder]
        if (dcdInfo[1] === -1) { // this is a direct leaf
          let leafName = dcdInfo[0]
          let ID = 'leaf_' + leafName
          moveVectors.set(ID, [0, 0])
          let leafNode = this.descendants.get(ID)
          let leafPosition = carveNode.changePosition([leafNode.position.i, leafNode.position.j])
          let range = carveNode.getPositionRange([leafPosition])
          rangeSegments.set(ID, range)
          overallRange = [...overallRange, ...range]
        } else { // this is a child
          let childCID = dcdInfo[0]
          let ID = 'child_' + childCID
          moveVectors.set(ID, [0, 0])
          let childCluster = this.descendants.get(ID)
          let positions = []
          for (let leaf of childCluster.allLeaves) {
            let leafPosition = carveNode.changePosition([leaf[1].position.i, leaf[1].position.j])
            positions.push(leafPosition)
          }
          let range = carveNode.getPositionRange(positions)
          rangeSegments.set(ID, range)
          overallRange = [...overallRange, ...range]
        }
      }
      overallRange = carveNode.getPositionRange(overallRange)
      let centerPosition = {
        i: Math.round((overallRange[0][0] + overallRange[1][0]) / 2),
        j: Math.round((overallRange[0][1] + overallRange[1][1]) / 2)
      }
      this.centerPosition = centerPosition
      // Step 2:   decide which rows and columns should be carved
      let carveRows = new Map()
      for (let row = overallRange[0][1]; row <= overallRange[1][1]; row++) {
        carveRows.set(row, true)
      }
      let carveColumns = new Map()
      for (let column = overallRange[0][0]; column <= overallRange[1][0]; column++) {
        carveColumns.set(column, true)
      }
      for (let segment of rangeSegments) {
        let ranges = segment[1]
        if (ranges.length === 1) {
          carveRows.set(ranges[0][1] - 1, false)
          carveRows.set(ranges[0][1], false)
          carveColumns.set(ranges[0][0] - 1, false)
          carveColumns.set(ranges[0][0], false)
        } else {
          for (let row = ranges[0][1]; row <= ranges[1][1]; row++) {
            carveRows.set(row - 1, false)
            carveRows.set(row, false)
          }
          for (let column = ranges[0][0]; column <= ranges[1][0]; column++) {
            carveColumns.set(column - 1, false)
            carveColumns.set(column, false)
          }
        }
      }
      // Step 3:   derive the moveVectors
      // carve points:   where to start the carving
      let carvePointsRow = new Map() // -- row - IDs to start carve
      let carvePointsColumn = new Map() // -- column - IDs to start carve
      for (let segment of rangeSegments) {
        let ID = segment[0]
        let carvePointRow
        let carvePointColumn
        let ranges = segment[1]
        if (ranges.length === 1) { // this is a direct leaf
          carvePointRow = ranges[0][1]
          carvePointColumn = ranges[0][0]
        } else { // this is a child
          // for the rows
          if (ranges[0][1] > centerPosition.j) { // Case 1:   positive side to the center
            carvePointRow = ranges[0][1]
          }
          if (ranges[1][1] < centerPosition.j) { // Case 2:   negative side to the center
            carvePointRow = ranges[1][1]
          }
          // Case 3:   across the center, doesn't need to be carved
          // for the columns
          if (ranges[0][0] > centerPosition.i) { // Case 1:   positive side to the center
            carvePointColumn = ranges[0][0]
          }
          if (ranges[1][0] < centerPosition.j) { // Case 2:   negative side to the center
            carvePointColumn = ranges[1][0]
          }
          // Case 3:   across the center, doesn't need to be carved
        }
        let IDsRow = carvePointsRow.get(carvePointRow) || []
        IDsRow = [...IDsRow, ID]
        carvePointsRow.set(carvePointRow, IDsRow)
        let IDsColumn = carvePointsColumn.get(carvePointColumn) || []
        IDsColumn = [...IDsColumn, ID]
        carvePointsColumn.set(carvePointColumn, IDsColumn)
      }
      // count the carves
      // for the rows
      let carveValue = 0
      for (let row = centerPosition.j; row <= overallRange[1][1]; row++) { // the positive side
        if (carveRows.get(row)) {
          carveValue--
        }
        if (carvePointsRow.has(row)) {
          let IDs = carvePointsRow.get(row)
          for (let ID of IDs) {
            let vector = moveVectors.get(ID)
            vector[1] = carveValue
            moveVectors.set(ID, vector)
          }
        }
      }
      carveValue = 0
      for (let row = centerPosition.j; row >= overallRange[0][1]; row--) { // the negative side
        if (carveRows.get(row)) {
          carveValue++
        }
        if (carvePointsRow.has(row)) {
          let IDs = carvePointsRow.get(row)
          for (let ID of IDs) {
            let vector = moveVectors.get(ID)
            vector[1] = carveValue
            moveVectors.set(ID, vector)
          }
        }
      }
      // for the columns
      carveValue = 0
      for (let column = centerPosition.i; column <= overallRange[1][0]; column++) { // the positive side
        if (carveColumns.get(column)) {
          carveValue--
        }
        if (carvePointsColumn.has(column)) {
          let IDs = carvePointsColumn.get(column)
          for (let ID of IDs) {
            let vector = moveVectors.get(ID)
            vector[0] = carveValue
            moveVectors.set(ID, vector)
          }
        }
      }
      carveValue = 0
      for (let column = centerPosition.i; column >= overallRange[0][0]; column--) { // the negative side
        if (carveColumns.get(column)) {
          carveValue++
        }
        if (carvePointsColumn.has(column)) {
          let IDs = carvePointsColumn.get(column)
          for (let ID of IDs) {
            let vector = moveVectors.get(ID)
            vector[0] = carveValue
            moveVectors.set(ID, vector)
          }
        }
      }
      return moveVectors
    } // end of getRoughCarvingVectors

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
