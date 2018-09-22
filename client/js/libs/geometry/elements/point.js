define([
  'exportClassFromAMD'
], function (ExportClass) {
  class Point {
    // constructor: [x, y]
    constructor (externalID, coordinates) {
      this.type = 'point'
      this.ID = externalID
      this.tolerance = Number.EPSILON * 100
      this.coordinates = this.getCoordinates(coordinates)
    } // end of constructor of Point

    getCoordinates (coordinates) {
      let x = coordinates[0]
      let y = coordinates[1]
      if (Math.abs(x) < this.tolerance) { x = 0 }
      if (Math.abs(y) < this.tolerance) { y = 0 }
      return { x: x, y: y }
    } // end of getCoordinates
  } // end of class Point

  return ExportClass(Point)
})
