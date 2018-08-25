define([
  'exportClassFromAMD'
], function (ExportClass) {
  class Point {
    // constructor: [x, y]
    constructor (externalID, coordinates) {
      this.type = 'point'
      this.ID = externalID
      this.coordinates = {
        x: coordinates[0],
        y: coordinates[1]
      }
    } // end of constructor of Point
    } // end of class Point

  return ExportClass(Point)
})
