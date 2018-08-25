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
      this.vertexes = this.getVertexes()
    } // end of constructor of Hexagon

    // get the coordinates of the center
    getCenterCoordinates () {
      let intPos = this.position
      return [
        (intPos.j % 2 === 0) ? (2 * this.radius * intPos.i) : ((2 - 1 / Math.abs(intPos.i)) * this.radius * intPos.i),
        Math.sqrt(3) * this.radius * intPos.j
      ]
    } // end of getCenterCoordinates

    // get the positions of its neighbors
    getNeighborsInPosition () {
      let neighbors = new Map() // map: direction in degree (key) - position (value)
      let intPos = this.center.integerPosition
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

    // get the vertexes of the hexagon
    getVertexes () {
      let vertexes = new Map() // map: direction in degree (key) - Point (value)
      let newPoint = GeoElements.Point
      let vertexDistance = this.radius * 2 * Math.sqrt(3) / 3
      for (let i = 0; i < 6; i++) {
        let directionInDegree = 30 + 60 * i
        let directionInArc = directionInDegree / 180 * 2 * Math.PI
        let vertexCoordinates = [vertexDistance * Math.cos(directionInArc), vertexDistance * Math.sin(directionInArc)]
        vertexes.set(directionInDegree, newPoint(i, vertexCoordinates))
      }
      return vertexes
    } // end of getVertexes
    } // end of class Hexagon

  return ExportClass(Hexagon)
})
