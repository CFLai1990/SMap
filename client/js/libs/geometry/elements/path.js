define([
  'exportClassFromAMD'
], function (ExportClass) {
  class Path {
    constructor (externalID, points, closed = false) {
      this.type = 'path'
      this.ID = externalID
      this.points = points
      this.closed = closed
    } // end of constructor of Path
    } // end of class Path

  return ExportClass(Path)
})
