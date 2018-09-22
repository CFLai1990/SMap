define([
  './point',
  './edge',
  './path'
], function (Point, Edge, Path) {
  let getPathsByEdges = function (edges) {
    // indices
    let indices = []
    for (let i = 0; i < edges.length; i++) {
      indices.push(i)
    }
    let currentEdge = edges[indices[0]]
    indices.splice(0, 1)
    // paths
    let paths = []
    paths.push([])
    let isNewPath = true
    let pathID = 0
    // while there are still edges, connect them
    while (indices.length > 0) {
      let matchFound = false
      for (let i = 0; i < indices.length; i++) { // loop until a match is found
        let connectPath = currentEdge.connectTo(edges[indices[i]])
        if (connectPath !== false && connectPath != null) {
          matchFound = true // found the match
          if (isNewPath) {
            // new path:   put in the whole path
            isNewPath = false
            paths[pathID].push(...connectPath)
          } else {
            // old path:   put in the last point
            if (connectPath[2] == null) {
              console.log(currentEdge, edges[indices[i]])
            }
            paths[pathID].push(connectPath[2])
          }
          currentEdge = edges[indices[i]]
          indices.splice(i, 1)
          break
        }
      }
      if (!matchFound) { // match not found
        // the old edge is abandoned
        // indices
        currentEdge = edges[indices[0]]
        indices.splice(0, 1)
        // paths
        paths.push([])
        isNewPath = true
        pathID++
      }
    }
    let Paths = []
    for (let i = 0; i < paths.length; i++) {
      if (paths[i].length === 0) { // an empty path
        continue
      }
      let newPath = Path(`Path_${Paths.length}`, paths[i], true)
      Paths.push(newPath)
    }
    return Paths
  } // end of getPathsByEdges

  let geometryMethods = {
    getPathsByEdges: getPathsByEdges
  } // end of geometryMethods

  return geometryMethods
})
