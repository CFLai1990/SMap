define([
  './point',
  'exportClassFromAMD'
], function (Point, ExportClass) {
  class Edge {
    // constructor: 'string', [x, y], [x, y]
    constructor (externalID, startCoordinates, endCoordinates, nghPositions) {
      this.type = 'edge'
      this.ID = externalID
      this.start = Point(0, startCoordinates)
      this.end = Point(1, endCoordinates)
      this.length = this.getLength()
      this.tolerance = Number.EPSILON * 100
      this.nghPositions = this.getNeighbors(nghPositions)
    } // end of constructor of Edge

    // get the length of the edge
    getLength () {
      let start = this.start
      let end = this.end
      return Math.sqrt(Math.pow(end.coordinates.x - start.coordinates.x, 2) + Math.pow(end.coordinates.y - start.coordinates.y, 2))
    } // end of getLength

    // whether this edge is same to another edge
    sameTo (thatEdge) {
      if (this.nghPositions != null && thatEdge.nghPositions != null) {
        return this.nghPositions === thatEdge.nghPositions
      } else {
        return this.compareWith(thatEdge)
      }
    } // end of sameTo

    // compare this edge  with another edge
    compareWith (thatEdge, compareFunc, direction = false) {
      let s2s = Math.sqrt(Math.pow(this.start.coordinates.x - thatEdge.start.coordinates.x, 2) + Math.pow(this.start.coordinates.y - thatEdge.start.coordinates.y, 2))
      let e2e = Math.sqrt(Math.pow(this.end.coordinates.x - thatEdge.end.coordinates.x, 2) + Math.pow(this.end.coordinates.y - thatEdge.end.coordinates.y, 2))
      let s2e = Math.sqrt(Math.pow(this.start.coordinates.x - thatEdge.end.coordinates.x, 2) + Math.pow(this.start.coordinates.y - thatEdge.end.coordinates.y, 2))
      let e2s = Math.sqrt(Math.pow(this.end.coordinates.x - thatEdge.start.coordinates.x, 2) + Math.pow(this.end.coordinates.y - thatEdge.start.coordinates.y, 2))
      if (compareFunc == null) {
        if (!direction) {
          return (s2s < this.tolerance && e2e < this.tolerance) || (s2e < this.tolerance && e2s < this.tolerance)
        } else {
          return (s2s < this.tolerance && e2e < this.tolerance)
        }
      } else {
        return compareFunc.call(this, [s2s, e2e], [s2e, e2s])
      }
    } // end of compare

    // connect this edge with another edge
    connectTo (thatEdge) {
      let compareFunc = function ([s2s, e2e], [s2e, e2s]) {
        if (s2s < this.tolerance && e2e < this.tolerance) {
          return [this.start, this.end]
        }
        if (s2e < this.tolerance && e2s < this.tolerance) {
          return [this.start, this.end]
        }
        if (s2s < this.tolerance) {
          return [this.end, this.start, thatEdge.end]
        }
        if (e2s < this.tolerance) {
          return [this.start, this.end, thatEdge.end]
        }
        if (e2e < this.tolerance) {
          return [this.start, this.end, thatEdge.start]
        }
        if (s2e < this.tolerance) {
          return [this.end, this.start, thatEdge.start]
        }
        return false
      }
      return this.compareWith(thatEdge, compareFunc)
    } // end of connectTo

    getNeighbors (nghPositions) {
      if (nghPositions == null) {
        return null
      } else {
        let neighbors = ''
        if (nghPositions[0][0] < nghPositions[1][0]) {
          neighbors = [nghPositions[0].join(','), nghPositions[1].join(',')].join('_')
        }
        if (nghPositions[0][0] > nghPositions[1][0]) {
          neighbors = [nghPositions[1].join(','), nghPositions[0].join(',')].join('_')
        }
        if (nghPositions[0][0] === nghPositions[1][0]) {
          if (nghPositions[0][1] < nghPositions[1][1]) {
            neighbors = [nghPositions[0].join(','), nghPositions[1].join(',')].join('_')
          } else {
            neighbors = [nghPositions[1].join(','), nghPositions[0].join(',')].join('_')
          }
        }
        return neighbors
      }
    }
  } // end of class Edge

  return ExportClass(Edge)
})
