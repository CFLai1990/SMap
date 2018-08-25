define([
  './point',
  'exportClassFromAMD'
], function (Point, ExportClass) {
  class Edge {
    // constructor: 'string', [x, y], [x, y]
    constructor (externalID, startCoordinates, endCoordinates) {
      this.type = 'edge'
      this.ID = externalID
      this.start = Point(0, startCoordinates)
      this.end = Point(1, endCoordinates)
      this.length = this.getLength()
    } // end of constructor of Edge

    // get the length of the edge
    getLength () {
      let start = this.start
      let end = this.end
      return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
    } // end of getLength
    } // end of class Edge

  return ExportClass(Edge)
})
