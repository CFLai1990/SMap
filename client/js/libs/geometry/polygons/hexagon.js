define([
  '../elements/index',
  'exportClassFromAMD'
], function (GeoElements, ExportClass) {
  class Hexagon {
    // constructor: [i, j], 'string', float
    constructor (externalID, radius, integerPosition) {
      this.type = 'hexagon'
      this.ID = externalID
      this.radius = radius
      this.position = {
        i: Math.round(integerPosition[0]),
        j: Math.round(integerPosition[1])
      }
      this.center = GeoElements.Point('center', this.getCenterCoordinates())
      this.neighbors = this.getNeighborsInPosition()
      this.edges = this.getEdges()
    } // end of constructor of Hexagon

    // get the coordinates of the center
    getCenterCoordinates () {
      let intPos = this.position
      return this.getCoordinatesByPosition(this.radius, [intPos.i, intPos.j])
    } // end of getCenterCoordinates

    // get the positions of its neighbors
    getNeighborsInPosition () {
      let neighbors = new Map() // map: direction in degree (key) - position (value)
      let intPos = this.position
      let x0, x1, x2, x3
      if (intPos.j % 2 === 0) {
        x0 = 1
        x1 = (intPos.i >= 0) ? 1 : 0
        x2 = (intPos.i <= 0) ? -1 : 0
        x3 = -1
      } else {
        x0 = (intPos.i === -1) ? 2 : 1
        x1 = (intPos.i < 0) ? 1 : 0
        x2 = (intPos.i > 0) ? -1 : 0
        x3 = (intPos.i === -1) ? -2 : -1
      }
      neighbors.set(0, [intPos.i + x0, intPos.j])
      neighbors.set(60, [intPos.i + x1, intPos.j + 1])
      neighbors.set(120, [intPos.i + x2, intPos.j + 1])
      neighbors.set(180, [intPos.i + x3, intPos.j])
      neighbors.set(240, [intPos.i + x2, intPos.j - 1])
      neighbors.set(300, [intPos.i + x1, intPos.j - 1])
      return neighbors
    } // end of getNeighborsInPosition

    // get the edges of the hexagon
    getEdges () {
      // Step 1:   get the vertexes
      let vertexes = new Map() // map: direction in degree (key) - Point (value)
      let vertexDistance = this.radius * 2 * Math.sqrt(3) / 3
      for (let i = 0; i < 6; i++) {
        let directionInDegree = 30 + 60 * i // range:   [30, 330]
        let directionInArc = directionInDegree / 180 * Math.PI
        let x = this.center.coordinates.x + vertexDistance * Math.cos(directionInArc)
        let y = this.center.coordinates.y + vertexDistance * Math.sin(directionInArc)
        let vertexCoordinates = [x, y]
        vertexes.set(directionInDegree, vertexCoordinates)
      }
      // Step 2:   get the edges
      let edges = new Map() // map: direction in degree (key) - Edge (value)
      let newEdge = GeoElements.Edge
      for (let i = 0; i < 6; i++) {
        let directionInDegree = 60 * i // range:   [0, 300]
        let startDirection = directionInDegree - 30
        let endDirection = directionInDegree + 30
        if (startDirection < 0) { startDirection += 360 }
        let edgeNghPosition = this.neighbors.get(directionInDegree)
        let thisPosition = [this.position.i, this.position.j]
        let edge = newEdge(directionInDegree, vertexes.get(startDirection), vertexes.get(endDirection), [thisPosition, edgeNghPosition])
        edges.set(directionInDegree, edge)
      }
      return edges
    } // end of getEdges

    // find the position of a point by its coordinates
    getPositionByCoordinates (radius, coordinates) {
      let j = Math.round(coordinates[1] * Math.sqrt(3) / (3 * radius))
      let i = coordinates[0] / (2 * radius)
      if (j % 2 !== 0) {
        i = Math.round(coordinates[0] / (2 * radius))
      } else {
        if (i > 0) {
          i = Math.round(i + 0.5)
        } else {
          i = Math.round(i - 0.5)
        }
      }
      return [i, j]
    } // end of getPositionByCoodinates

    getCoordinatesByPosition (radius, position) {
      let posOThis = [parseInt(position[0]), parseInt(position[1])]
      let x = (posOThis[1] % 2 === 0) ? (2 * radius * posOThis[0]) : ((2 - 1 / Math.abs(posOThis[0])) * radius * posOThis[0])
      let y = Math.sqrt(3) * radius * posOThis[1]
      return [x, y]
    } // end of getCoordinatesByPosition
  } // end of class Hexagon

  return ExportClass(Hexagon)
})
