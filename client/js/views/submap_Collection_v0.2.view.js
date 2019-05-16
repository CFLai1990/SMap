define(
  [
    'require',
    'marionette',
    'underscore',
    'jquery',
    'jqueryui',
    'hexbin',
    'voronoi',
    'backbone',
    'loadingjs',
    'datacenter',
    'config',
    'Base',
    'basicFunctions',
    'basicViewOperations',
    'Tiling',
    'libs/geometry/index',
    'libs/visibility',
    'SubRotate',
    'SubGlyph',
    'SubMap_ModelView'
  ],
    function (
        require,
        Mn,
        _,
        $,
        JQueryUI,
        HexBin,
        Voronoi,
        Backbone,
        LoadingJS,
        Datacenter,
        Config,
        Base,
        loadBasic,
        loadBasicView,
        Tile,
        Geometry,
        Visibility,
        Subrotate,
        Subglyph,
        SubMap_ModelView
    ) {
      'use strict'
      String.prototype.visualLength = function (d) {
        let ruler = $('#ruler')
        ruler.css('font-size', d + 'px').text(this)
        return [ruler[0].offsetWidth, ruler[0].offsetHeight]
      }

      let SubMap_CollectionView = Mn.CollectionView.extend(
            _.extend({
              tagName: 'g',
              attributes: {
                id: 'SubMap'
              },
              childView: SubMap_ModelView,
              childEvents: {},
              childViewOptions: {
                layout: null
              },

              initialize: function (options) {
                let svgWidth = parseFloat($('#SubMap_CollectionViewSVG').css('width'))
                let svgHeight = parseFloat($('#SubMap_CollectionViewSVG').css('height'))
                let canvasSize = Config.get('drawSize')
                let showSize = Math.min(svgWidth, svgHeight)
                let defaultOThis = {
                  canvasSize: canvasSize,
                  size: showSize,
                  sizeTolr: Number.EPSILON * 1000 * (showSize / canvasSize),
                  scales: {
                    x: d3.scale.linear().range([-canvasSize * 0.5, canvasSize * 0.5]).domain([0, 1]),
                    y: d3.scale.linear().range([-canvasSize * 0.5, canvasSize * 0.5]).domain([0, 1])
                  },
                  r: 2,
                  dimCover: [],
                  ovlDataWeights: null,
                  ovlDataLength: null,
                  distMat: null,
                  diffMat: null,
                  distExt: null,
                  nghList: null,
                  zoomed: false,
                  newData: true,
                  glyphSize: null,
                  visible: null,
                  pattern: false,
                  nghDims: null,
                  clsAggr: null,
                  freeDim: null,
                  fCodes: null,
                  fMatrix: null,
                  colors: null,
                  currentColors: null,
                  colorFixed: false,
                  transition: Config.get('transition'),
                  overallCls: {
                    clusters: null,
                    level: null,
                    paths: null,
                    aggregate: null
                  },
                  currentCls: {
                    clusters: null,
                    level: null,
                    paths: null,
                    aggregate: null
                  },
                  isNew: true,
                  overallMap: null,
                  mapTransition: {
                    indeces: null, // old indeces
                    tranIndeces: null, // transition from old to current indeces
                    nameBook: null, // original id to current indeces
                    colors: null
                  },
                  snapshotPar: {
                    ringR: null,
                    ringRRatio: 0.5,
                    marginRatio: 0.01,
                    sshotR: null,
                    sshotRRatio: 0.05,
                    outR: null,
                    anchorR: 4,
                    angInterval: 2
                  },
                  interactions: {
                    ready: false,
                    hoveredID: null
                  },
                  clsColorReady: false
                }
                        // pass on the options and defaults
                options = options || {}
                _.extend(this, options)
                _.extend(this, defaultOThis)
                this.layout = Config.get('childviewLayout')
                        // bind the communications
                this.listenTo(Config, 'change:gridNumber', this.showMap)
                this.listenTo(this.collection, 'SubMapCollection__ShowMap', this.showMap)
                this.listenTo(this.collection, 'SubMapCollection__UpdateProgress', this.updateProgress)
                this.listenTo(Datacenter, 'SubListCollectionView__getDimensionCoverage', this.getDimCoverage)
              }, // end of initialize

              onShow: function () {
                let canvasWidth = parseFloat($('#SubMap_CollectionViewSVG').css('width'))
                let canvasHeight = parseFloat($('#SubMap_CollectionViewSVG').css('height'))
                let canvasScale = this.size / this.canvasSize
                let canvasTranslate = [canvasWidth / 2, canvasHeight / 2]
                d3.select('#SubMap_CollectionView').attr('transform', 'translate(' + canvasTranslate + ')scale(' + canvasScale + ')')
              }, // end of onShow

              bindAll: function () {
                let replaceFunction = (func, obj) => {
                  return function (data) { func.call(obj, data) }
                }
                let interactions = this.interactions
                let filterByDims = interactions.filterByDims
                let filterByIDs = interactions.filterByIDs
                let pinByIDs = interactions.pinByIDs
                let zoomByDims = interactions.zoomByDims
                this.listenTo(Datacenter, 'SubListCollectionView__FilterByIDs', replaceFunction(filterByIDs, interactions))
                this.listenTo(Datacenter, 'SubListCollectionView__PinByIDs', replaceFunction(pinByIDs, interactions))
                this.listenTo(Datacenter, 'SubListCollectionView__FilterByDims', filterByDims)
                this.listenTo(Datacenter, 'SubListCollectionView__ZoomByDims', zoomByDims)
                this.bindTuning()
              }, // end of bindAll

              updateProgress: function (parameters, showProgress = true) {
                if (showProgress) {
                  Loading.selector('body')
                                .progressBar(true)
                                .text(parameters[0])
                                .progressVal(parameters[1])
                                .show(true)
                                .update()
                } else {
                  Loading.selector('body')
                                .show(false)
                                .update()
                }
              }, // end of updateProgress

              initInteractions: function () {
                let thisView = this
                let d3el = this.d3el
                let thisCollection = this.collection
                let interactions = this.interactions
                let transDuration = this.transition.duration
                let filterCodes = this.fCodes
                let overallContainer = thisView.d3el
                if (!interactions.ready) {
                  interactions.ready = true
                  interactions.duration = transDuration
                  interactions.container = thisView.d3el
                  interactions.clickTimer = null
                  interactions.checkRelation = function (path2A, path2B, relationType) {
                    let lengthCondition = false
                    let endOFunction = false
                    let confirmed = true
                    let lengthOParents
                    switch (relationType) {
                      case 'fellows': // same level
                        confirmed = lengthCondition = path2B.length === path2A.length
                        endOFunction = true
                        break
                      case 'brothers': // same level, same parent
                        lengthCondition = path2B.length === path2A.length
                        lengthOParents = path2A.length - 1
                        break
                      case 'descendants': // the whole subtree
                        lengthCondition = path2B.length > path2A.length // check if A is a parent of B
                        lengthOParents = path2A.length
                        break
                    }
                    if (endOFunction) { return confirmed } // 'fellow' examination ended
                    if (!lengthCondition) { return false }
                    for (let i = 0; i < lengthOParents; i++) {
                      if (path2B[i] !== path2A[i]) {
                        confirmed = false
                        break
                      }
                    } // 'brothers' and 'descendants' must have the same parents
                    if (relationType === 'brothers') {
                      confirmed = confirmed && path2B[lengthOParents] !== path2A[lengthOParents]
                    } // 'brothers' must not be the same node
                    return confirmed
                  } // end of interactions.checkRelation
                  interactions.standOut = function (thisContainer, clusterID) { // highlight some cluster
                    d3.select(thisContainer)
                                    .selectAll('line')
                                    .classed('chosen', true)
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('stroke', '#000')
                                    .attr('stroke-opacity', 1.0)
                    let d3Selection = overallContainer
                                    .selectAll('.SubMapSShot')
                                    .filter(function () { return d3.select(this).attr('clsID') === clusterID })
                    BasicView.showOnTop(d3Selection[0], $(d3Selection[0]).parent()[0])
                  } // end of interactions.standOut
                  interactions.fadeOutAll = function () {
                    overallContainer
                                    .selectAll('.SubMapClusters path')
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('fill-opacity', 0.0)
                    overallContainer
                                    .selectAll('.SubMapClusters line')
                                    .classed('chosen', false)
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('stroke', '#666')
                                    .attr('stroke-opacity', 0.8)
                  } // end of interactions.fadeOutAll
                  interactions.fadeOutOthers = function (className) { // Fade out other clusters and outliers
                    let fadedSelection = overallContainer
                                    .selectAll('.SubMapClusters')
                                    .filter(function (d, i) { return className !== d3.select(this).attr('class') })
                    fadedSelection
                                    .selectAll('path')
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('fill-opacity', 0.8)
                    fadedSelection
                                    .selectAll('line')
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('stroke-opacity', 0)
                  } // end of interactions.fadeOutOthers
                  interactions.saveBrothers = function (path2Cluster) {
                    let checkRelationFunction = this.checkRelation
                    let brotherSelection = overallContainer
                                    .selectAll('.SubMapClusters')
                                    .filter(function (elemOThis, orderOThis) {
                                      let path2This = d3.select(this).attr('clsID')
                                      if (path2This != null) { path2This = path2This.split('_') }
                                      if (d3.select(this).classed('Outliers')) {
                                        let path2Parent = path2Cluster.slice(0, path2Cluster.length - 1)
                                        return checkRelationFunction(path2Parent, path2This, 'descendants')
                                      } else {
                                        return checkRelationFunction(path2Cluster, path2This, 'brothers')
                                      }
                                    })
                    brotherSelection
                                    .selectAll('path')
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('fill-opacity', 0.1)
                    brotherSelection
                                    .selectAll('line')
                                    .interrupt()
                                    .transition()
                                    .duration(transDuration)
                                    .attr('stroke', '#666')
                                    .attr('stroke-opacity', 1.0)
                  } // end of interactions.saveBrothers
                  interactions.mouseOver = function (thisCluster, isOutlier) {
                    if (!isOutlier) {
                      BasicView.showOnTop(thisCluster, '.SubMapTiling')
                      let path2This = d3.select(thisCluster).attr('clsID')
                      if (path2This != null && path2This.length > 0) {
                        path2This = path2This.split('_')
                        let idsOThis = this.filterByIDs(thisView.getClsByPath.call(thisView, path2This))
                        let dataWeightsOThis = thisCollection.subTree.findByIndex(path2This).data.dataWeights
                        let overallDataWeights = thisView.ovlDataWeights = thisCollection.subTree.data.dataWeights
                        dataWeightsOThis = numeric.sub(overallDataWeights, dataWeightsOThis)
                        this.informOthers(idsOThis, dataWeightsOThis, false)
                        thisView.informOthers('SubMapCollectionView__Highlighting', path2This)
                      }
                      this.standOut(thisCluster, path2This)
                    }
                  } // end of interactions.mouseOver
                  interactions.mouseOut = function (isOutlier) {
                    if (!isOutlier) {
                      this.fadeOutAll()
                      let ids = this.filterByIDs()
                      this.informOthers(ids, null, false)
                      thisView.informOthers('SubMapCollectionView__Highlighting', null)
                      this.filterByIDs()
                      this.informOthers()
                    }
                  } // end of interactions.mouseOut
                  interactions.informOthers = function (ids, dataWeights, isTranslate = true, isPin = false) {
                    let leafNames
                    if (ids != null) {
                      if (isTranslate) {
                        leafNames = thisView.getClsByPath(ids)
                      } else {
                        leafNames = ids
                      }
                    }
                    let message
                    if (isPin) {
                      if (isTranslate === false) {
                        this.projectByIDs(leafNames)
                      } else {
                        this.projectByCluster(ids)
                      }
                      message = 'SubMapCollectionView__Pin'
                    } else {
                      message = 'SubMapCollectionView__Choose'
                    }
                    thisView.informOthers(message, {
                      attr: 'index',
                      IDs: leafNames,
                      weights: dataWeights,
                      inform: false
                    })
                  } // end of interactions.informOthers
                  interactions.pinning = function (thisContainer, isBlock = true) {
                    let targetSelection = d3.select(thisContainer)
                    let pinned = targetSelection.classed('pinned')
                    let clsID
                    let leafNames
                    d3el.selectAll('.SubMapClusters.pinned').classed('pinned', false)
                    if (!pinned) {
                      if (isBlock) {
                        clsID = targetSelection.attr('clsID').split('_')
                        leafNames = thisView.getClsByPath.call(thisView, clsID)
                        leafNames = SubGlyph.pickGlyphsByIDs(d3el, leafNames, 'index')
                        targetSelection.classed('pinned', true)
                      } else {
                        leafNames = [targetSelection.attr('index')]
                        leafNames = SubGlyph.pickGlyphsByIDs(d3el, leafNames, 'index')
                      }
                    } else {
                      SubGlyph.pickGlyphsByIDs(d3el, null, 'index')
                                    // targetSelection.classed("pinned", false);
                    }
                    if (isBlock === true) {
                      this.informOthers(clsID, null, true, true)
                    } else {
                      this.informOthers(leafNames, null, false, true)
                    }
                  }
                            // end of interactions.pinning
                  interactions.filterByDims = function (filterSettings) {
                    let returnedData = {
                      indeces: SubGlyph.filterGlyphsByDims(d3el, filterSettings, 'index', null, filterCodes.codes),
                      illegal: filterSettings.filter(d => { return d !== 0 }).length < 2
                    }
                    thisCollection.trigger('Transmission', {
                      type: 'trans',
                      message: 'SubMapCollectionView__Filtering',
                      data: returnedData
                    })
                    let indeces = returnedData.indeces
                    if (indeces.length == filterCodes.codes.length) {
                      interactions.projectByIDs(null)
                    } else {
                      interactions.projectByIDs(returnedData.indeces)
                    }
                  } // end of interactions.filterByDims
                  interactions.filterByIDs = function (leafNames) {
                    return SubGlyph.filterGlyphsByIDs(d3el, leafNames, 'index')
                  } // end of interactions.filterByIDs
                  interactions.pinByIDs = function (leafNames) {
                    d3el.selectAll('.SubMapClusters.pinned').classed('pinned', false)
                    SubGlyph.pickGlyphsByIDs(d3el, leafNames)
                    this.projectByIDs(leafNames)
                  } // end of interactions.pinByIDs
                  interactions.projectByIDs = function (leafNames) {
                                // Case 1:   the default projection
                    if (leafNames == null || leafNames.length === 0) {
                      thisCollection.trigger('Transmission', {
                        type: 'trans',
                        message: 'SubMapCollectionView__DefaultProjection',
                        data: null
                      })
                    } else {
                      let codeBook = thisCollection.subIndex
                                    // Case 2:   an individual subspace, show it
                      if (leafNames.length === 1) {
                        let codesOTarget = codeBook[leafNames[0]]
                        thisCollection.trigger('Transmission', {
                          type: 'trans',
                          message: 'SubMapCollectionView__ShowProjection',
                          data: this.fixCode(codesOTarget)
                        })
                      } else {
                                        // Case 3:   multiple subspaces, hide it
                        thisCollection.trigger('Transmission', {
                          type: 'trans',
                          message: 'SubMapCollectionView__HideProjection',
                          data: true
                        })
                      }
                    }
                  } // interactions.projectByIDs
                  interactions.projectByCluster = function (cid) {
                    thisCollection.trigger('Transmission', {
                      type: 'trans',
                      message: 'SubMapCollectionView__ShowCluster',
                      data: cid
                    })
                  } // interactions.projectByCluster
                  interactions.fixCode = function (targetCodes) {
                    let dimCover = thisView.dimCover
                    let dimLength = dimCover.length
                    let code = new Array(dimLength)
                    let count = 0
                    for (let i = 0; i < dimLength; i++) {
                      if (dimCover[i] >= 0) {
                        code[i] = dimCover[i]
                      } else {
                        code[i] = targetCodes[count]
                        count++
                      }
                    }
                    return code
                  } // end of interactions.fixCode
                  interactions.zoomByDims = function (targetData) {
                    let subZoom = zooming => {
                      let free = 0
                      let fixed = 0
                      for (let i = 0; i < thisView.dimCover.length; i++) {
                        if (thisView.dimCover[i] < 0) {
                          free++
                        } else {
                          fixed++
                        }
                      }
                      if ((zooming && free < 3) || (!thisView.zoomed && !zooming)) {} else {
                        if (!zooming || (zooming && free < thisView.freeDim)) {
                          thisView.zoomed = zooming
                          thisView.freeDim = zooming ? free : thisView.dimCover.length
                          thisView.pipeline()
                        }
                      }
                    }
                    let dims = targetData.dims
                    let zooming = targetData.zoomin
                    if (dims != null) {
                      thisView.dimCover = dims
                      subZoom(zooming)
                    }
                  } // end of interactions.zoomByDims
                }
              }, // end of initInteractions

              informOthers: function (message, data) {
                this.collection.trigger('Transmission', {
                  type: 'trans',
                  message: message,
                  data: data
                })
              }, // end of informOthers

              showMap: function () {
                let df = $.Deferred()
                this.clearAll()
                this.pipeline(df)
                this.bindAll()
                $.when(df).done(() => {
                  this.updateProgress(null, false)
                })
              }, // end of showMap

              pipeline: function (df) {
                let dfOColors = $.Deferred()
                let dfOClusters = $.Deferred()
                let dfOOthers = $.Deferred()
                this.clearCanvas()
                this.filtering()
                this.initInteractions()
                this.coloring(dfOColors)
                $.when(dfOColors).done(() => {
                  this.clustering(dfOClusters)
                })
                $.when(dfOClusters).done(() => {
                  this.showTiling(dfOOthers)
                })
                $.when(dfOOthers).done(() => {
                  if (df != null) { df.resolve() }
                })
              }, // end of pipeline

              filtering: function () {
                let filterMatrix = (codeBook, indices) => {
                  let dataLength = this.ovlDataLength = codeBook.length
                  if (!this.distMat) { this.distMat = this.collection.dataDist }
                  if (!this.diffMat) {
                    let diffMatrix = Basic.initArray(dataLength, dataLength)
                    for (let i = 0; i < diffMatrix.length - 1; i++) {
                      for (let j = i + 1; j < diffMatrix[i].length; j++) {
                        let codeOI = codeBook[i]
                        let codeOJ = codeBook[j]
                        let diffOIJ = 0
                        for (let k = 0; k < codeOI.length; k++) {
                          if (codeOI[k] !== codeOJ[k]) { diffOIJ++ }
                        }
                        diffMatrix[i][j] = diffMatrix[j][i] = diffOIJ
                      }
                    }
                    this.diffMat = diffMatrix
                  }
                  if (!this.nghList) { this.nghList = this.collection.subNghList }
                  if (!this.distExt) { this.distExt = Basic.extArray(this.distMat) }
                  if (!this.colors) { this.colors = this.collection.colors }
                  if (indices === null) {
                    this.updateMapTrans()
                    return {
                      neighbors: this.nghList,
                      distMat: this.distMat,
                      diffMat: this.diffMat,
                      distExt: this.distExt,
                      colors: this.colors
                    }
                  } else {
                    let distMatrix = Basic.subArray(
                                    this.distMat,
                                    indices,
                                    indices
                                )
                    let diffMatrix = Basic.subArray(
                                    this.diffMat,
                                    indices,
                                    indices
                                )
                    let nghList = Basic.KNNGByDistMat(
                                    distMatrix,
                                    Config.get('SUB_K')
                                )
                    let distExt = Basic.extArray(distMatrix)
                    this.updateMapTrans(indices)
                    return {
                      neighbors: nghList,
                      distMat: distMatrix,
                      diffMat: diffMatrix,
                      distExt: distExt,
                      colors: null
                    }
                  }
                } // end of filterMatrix
                let filterCodes = (codes, dimCover) => {
                  let isEmpty = true
                  let dimIndices
                  if (dimCover != null) {
                    for (let i = 0; i < dimCover.length; i++) {
                      if (!isEmpty) { continue }
                      if (dimCover[i] >= 0) { isEmpty = false }
                    }
                  }
                  if (isEmpty) {
                    dimIndices = new Array(codes[0].length)
                    for (let i = 0; i < dimIndices.length; i++) {
                      dimIndices[i] = i
                    }
                    return {
                      codes: codes,
                      dataIndeces: null,
                      dimIndeces: dimIndices
                    }
                  } else {
                    dimIndices = []
                    let returnedCodes = new Array()
                    let dataIndices = new Array()
                    let changed = false
                    for (let i = 0; i < codes.length; i++) {
                      let code = codes[i]
                      let fit = true
                      for (let j = 0; j < dimCover.length; j++) {
                        let dimension = dimCover[j]
                        if (dimension < 0 || !fit) {
                          continue
                        } else {
                          if (code[j] !== dimension) { fit = false }
                        }
                      }
                      if (fit) {
                        dataIndices.push(i)
                        let newCode = []
                        for (let j = 0; j < dimCover.length; j++) {
                          let dimension = dimCover[j]
                          if (dimension < 0) {
                            if (!changed) { dimIndices[newCode.length] = j }
                            newCode.push(code[j])
                          }
                        }
                        if (!changed) { changed = true }
                        returnedCodes.push(newCode)
                      }
                    }
                    return {
                      codes: returnedCodes,
                      dataIndeces: dataIndices,
                      dimIndeces: dimIndices
                    }
                  }
                } // end of filterCodes
                let dimCover = this.zoomed ? this.dimCover : null
                this.fCodes = filterCodes(this.collection.subIndex, dimCover)
                this.fMatrix = filterMatrix(
                            this.collection.subIndex,
                            this.fCodes.dataIndeces
                        )
                let dimCount = this.collection.dimCount
                this.informOthers('SubMapCollectionView__DimensionFiltering', {
                  dimCover: dimCover,
                  codeLength: dimCount
                })
              }, // end of filtering

              updateMapTrans: function (newIndices) {
                let mapTrans = this.mapTransition
                let oldIndices = mapTrans.indeces
                let overallLength = this.ovlDataLength
                if (newIndices == null) {
                  let nameBook = new Map()
                  for (let i = 0; i < overallLength; i++) {
                    nameBook.set(i, i)
                  }
                  mapTrans.nameBook = nameBook
                  if (oldIndices != null) {
                    let newMap = new Map()
                    for (let i = 0; i < oldIndices.length; i++) {
                      newMap.set(i, oldIndices[i])
                    }
                    mapTrans.tranIndeces = newMap
                  }
                } else {
                  let newMap = new Map()
                  let nameBook = mapTrans.nameBook
                  for (let i = 0; i < newIndices.length; i++) {
                    newMap.set(newIndices[i], i)
                  }
                  for (let i = 0; i < overallLength; i++) {
                    if (newMap.has(i)) {
                      nameBook.set(i, newMap.get(i))
                    } else {
                      nameBook.set(i, null)
                    }
                  }
                  if (oldIndices == null) {
                    mapTrans.tranIndeces = newMap
                  } else {
                    let tranMap = new Map()
                    for (let i = 0; i < oldIndices.length; i++) {
                      let originalIndex = oldIndices[i]
                      if (newMap.has(originalIndex)) {
                        tranMap.set(i, newMap.get(originalIndex))
                      }
                    }
                    mapTrans.tranIndeces = tranMap
                  }
                }
                mapTrans.indeces = newIndices
              }, // end of updateMapTrans

              coloring: function (df) {
                let dfOThis = $.Deferred()
                dfOThis.resolve(this.fMatrix.colors)
                $.when(dfOThis).done(colors => {
                  this.currentColors = colors
                  df.resolve()
                })
              }, // end of coloring

              clustering: function (df) {
                let prepareCluster = () => {
                  let distanceType = Config.get('clusterDistMat')
                  let proj = this.currentColors
                  let projDist
                  switch (distanceType) {
                    case 'projection':
                      let projLength = proj.length
                      projDist = Basic.initArray(projLength, projLength)
                      for (let i = 0; i < projLength - 1; i++) {
                        for (let j = i + 1; j < projLength; j++) {
                          projDist[i][j] = projDist[j][i] = Basic.getDistance(proj[i], proj[j])
                        }
                      }
                      break
                    case 'original':
                      projDist = null
                      break
                  }
                  return [proj.length, projDist]
                } // end of prepareCluster
                let storeCluster = (v_clusters, v_level) => {
                  this.currentCls = {
                    clusters: v_clusters,
                    level: v_level,
                    paths: null,
                    aggregate: null
                  }
                  this.aggregate()
                } // end of storeCluster
                let dfOThis = $.Deferred()
                let distMat = this.fMatrix.distMat
                if (this.zoomed) {
                  let parameters = prepareCluster()
                  this.currentCls = new Object()
                  this.collection.getSubHierClusters(dfOThis, true, ...parameters)
                } else {
                  dfOThis.resolve()
                }
                $.when(dfOThis).done((v_clusters, v_level) => {
                  if (!this.zoomed) {
                    if (this.overallCls.clusters == null) {
                      storeCluster(this.collection.clusters, this.collection.clusterLevel)
                      this.overallCls = this.currentCls
                    } else {
                      this.currentCls = this.overallCls
                    }
                    df.resolve()
                  } else {
                    storeCluster(v_clusters, v_level)
                    df.resolve()
                  }
                })
              }, // end of clustering

              getClsByPath: function (path2This, getIndices = true) {
                let dataIndices = this.fCodes.dataIndeces
                let levelOThis = path2This.length - 1
                let pathLevel = this.currentCls.paths[levelOThis]
                let prevCode = path2This.slice(0, path2This.length - 1).join('_')
                let IDOThis = path2This[path2This.length - 1]
                let returnedIDs = pathLevel.filter(path2Cluster => {
                  if (path2Cluster.outlier) { return false }
                  let code = path2Cluster.previous.join('_')
                  return code === prevCode
                })[0].ids[IDOThis]
                if (getIndices && dataIndices != null) {
                  let treturnedIDs = new Array(returnedIDs.length)
                  for (let i = 0; i < returnedIDs.length; i++) {
                    treturnedIDs[i] = dataIndices[returnedIDs[i]] + ''
                  }
                  returnedIDs = treturnedIDs
                } else {
                  for (let i = 0; i < returnedIDs.length; i++) {
                    returnedIDs[i] = returnedIDs[i] + ''
                  }
                }
                return returnedIDs
              }, // end of getClsByPath

              getDimCoverage: function (ids) {
                this.collection.trigger('Transmission', {
                  type: 'trans',
                  message: 'SubMapCollectionView__updateDimCoverage',
                  data: this.collection.getCoverage(ids)
                })
              }, // end of getDimCoverage

              renderNewMap: function (container, theMap, transDuration) {
                let filterCodes = this.fCodes
                let gridScales = this.scales
                let glyphSize = this.glyphSize
                let glyphColors = this.currentColors
                let leafNodes = Basic.mapToArray(theMap.allLeaves, 'values')
                let coordsRange = theMap.coordsRange
                let aspectRatio = coordsRange.aspectRatio
                if (aspectRatio > 1) {
                  let centerX = (coordsRange.x.min + coordsRange.x.max) / 2
                  let divX = (coordsRange.x.max - coordsRange.x.min) / 2
                  gridScales.x.domain([centerX - divX * aspectRatio, centerX + divX * aspectRatio])
                  gridScales.y.domain([coordsRange.y.min, coordsRange.y.max])
                } else {
                  let centerY = (coordsRange.y.min + coordsRange.y.max) / 2
                  let divY = (coordsRange.y.max - coordsRange.y.min) / 2
                  gridScales.x.domain([coordsRange.x.min, coordsRange.x.max])
                  gridScales.y.domain([centerY - divY / aspectRatio, centerY + divY / aspectRatio])
                }
                SubGlyph.init(glyphSize, glyphSize, Config.get('mapType'), Config.get('glyphType'), glyphColors)
                        // Step 1:   render containers for the cells
                let thisContainer = container.selectAll('.SubMapGrids')
                            .data(leafNodes)
                            .enter()
                            .append('g')
                            .attr('class', 'SubMapGrids')
                            .attr('index', cell => {
                              if (filterCodes.dataIndeces == null) {
                                return cell.ID
                              } else {
                                return filterCodes.dataIndeces[cell.ID]
                              }
                            })
                            .attr('gSize', glyphSize)
                            .classed('empty', cell => { return cell.ID == null })
                            .attr('position', cell => {
                              let centerCoords = cell.center.coordinates
                              return (Basic.scale(gridScales, [centerCoords.x, centerCoords.y])).join('_')
                            })
                            .attr('transform', cell => {
                              let centerCoords = cell.center.coordinates
                              return ('translate(' + Basic.scale(gridScales, [centerCoords.x, centerCoords.y]) + ')')
                            })
                        // '.SubMapTiling':   the top-level g container
                this.d3el.selectAll('.SubMapTiling')
                            .attr('opacity', 0)
                            .transition()
                            .duration(transDuration)
                            .attr('opacity', 1)
                        // Step 2:   prepare the cell parameters - colors and neighbors
                let filterMatrix = this.fMatrix
                let nghDistScale = d3.scale.linear().domain([filterMatrix.distExt.min, filterMatrix.distExt.max]).range([0, 0.8])
                let dimWeights = this.nghDims
                let pattern = this.pattern
                        // cellFunction:   render function for each cell
                let cellFunction = function (containerCell) {
                  let cell = d3.select(containerCell).data()[0]
                  let leafName = cell.ID // leafName
                            // Step 2-1:   get the color of the cell
                  let colorOCell = glyphColors[leafName] // color of this cell
                  colorOCell = [~~(255 * colorOCell[0]), ~~(255 * colorOCell[1]), ~~(255 * colorOCell[2])]
                  colorOCell = 'rgb(' + colorOCell + ')'
                            // Step 2-2:   prepare the neighbors
                  let neighbors
                  let angleUnit
                  switch (Config.get('gridType')) {
                    case 'hexagon':
                      angleUnit = 60
                      neighbors = new Array(6)
                      for (let i = 0; i < 6; i++) {
                        neighbors[i] = {
                          angle: (angleUnit * i / 180) * Math.PI,
                          diff: null,
                          dist: null
                        }
                      }
                                    // diffScale:   transform the code differences (by unit) into size
                                    // in mapType 'diff':   needed by subglyph.js for constructing 'bridges'
                      neighbors.diffScale = d3.scale.linear().domain([1, filterCodes.codes[0].Length]).range([0, glyphSize * Math.sqrt(3) * 2 / 3])
                      break
                  }
                            // Step 2-2:  still preparing the neighbors
                  for (let neighbor of cell.neighbors) {
                    let nghIntPos = neighbor[1]
                    let nghIndex = nghIntPos.join('_')
                    if (theMap.occupied.has(nghIndex)) { // the neighbor cell is also a leaf
                      let nghLeafName = theMap.occupied.get(nghIndex)
                      let nghID = Math.round(neighbor[0] / angleUnit)
                      neighbors[nghID].dist = nghDistScale(filterMatrix.distMat[leafName][nghLeafName])
                      neighbors[nghID].diff = filterMatrix.diffMat[leafName][nghLeafName]
                    }
                  }
                            // end of Step 2-2
                            // Step 2-3:   prepare the dimension weights
                  let weights = dimWeights[leafName]
                  let parameters = [d3.select(containerCell), neighbors, leafName, filterCodes.codes[leafName], colorOCell, pattern, weights, dimWeights.extent]
                  if (leafName == null) {
                    emptyCellParameters.add(parameters)
                  } else {
                    cellParameters.add(parameters)
                  }
                } // end of cellFunction
                let emptyCellParameters = new Set()
                let cellParameters = new Set()
                thisContainer.forEach(function (container) {
                  container.forEach(cellFunction) // end of containerRow.forEach
                }) // end of thisContainer.forEach
                        // Step 3:   render the cells
                let interactions = this.interactions
                cellParameters.forEach(cellParameter => {
                  let cellContainer = SubGlyph.showGlyph(...cellParameter)
                  cellContainer.on('click', function (cell) {
                    if (cell.id == null) { return }
                    interactions.pinning(this, false)
                  })
                }) // render non-empty cells
              }, // end of renderNewMap

              hideOldMap: function (df, theMap) {
                let glyphSize = this.glyphSize
                let gridScales = this.scales
                let glyphColors = this.currentColors
                let longDuration = this.transition.long
                let animationTime = this.visible.toLevel([0, 0], 0, longDuration)
                let dfOThis = $.Deferred()
                setTimeout(() => {
                  dfOThis.resolve()
                }, animationTime)
                $.when(dfOThis).done(() => {
                  let midDuration = 0
                  let endDuration = 0
                  if (!this.isNew) {
                    midDuration = longDuration * 0.5
                    endDuration = longDuration
                    this.hideClusters(true, midDuration)
                    setTimeout(() => {
                      this.moveGrids(theMap, gridScales, glyphColors, glyphSize, endDuration)
                    }, 300)
                  }
                  setTimeout(() => {
                    df.resolve(midDuration) // midDuration:   'transDuration' for renderNewMap
                  }, endDuration * 0.8)
                })
              }, // end of hideOldMap

              renderMap: function (df, container, theMap) {
                let dfOThis = $.Deferred()
                this.hideOldMap(dfOThis, theMap)
                $.when(dfOThis).done(transDuration => {
                  this.renderNewMap(container, theMap, transDuration)
                  df.resolve()
                })
              }, // end of renderMap

              showTiling: function (df) {
                let theMap
                        /* let mapGrids */
                        // Step 1:   get the map layout
                if (!this.zoomed && this.overallMap != null) {
                  theMap = this.overallMap
                } else {
                            /* mapGrids = Tiling.getMap(this.fMatrix.neighbors, this.fMatrix.distMat, this.fCodes.codes, Config.get('gridType'), Config.get('gridScaling'))
                            console.log('Map: ', mapGrids) */
                            // get the map layout
                  theMap = Geometry.layout.submap(this.collection.subTree, this.fMatrix.distMat, this.fCodes.codes, Config.get('gridType'), 2)
                  theMap.getMap()
                  window.theMap = theMap
                  if (!this.zoomed) {
                    this.overallMap = theMap
                  }
                }
                if (typeof theMap === 'string') { // failed
                  console.error('ERROR: ' + theMap)
                }
                        // Step 2:   update the map colors if necessary
                if (!this.freeDim) {
                  this.freeDim = this.fCodes.codes[0].length
                }
                let centerID = this.collection.subTree.data.centerLeafName[0]
                        /* let centerID = theMap.centerLeafName */
                if (this.zoomed) {
                  let colors = Basic.subArray(this.colors, this.fCodes.dataIndeces, [0, 1, 2])
                  this.currentColors = SubRotate.groupMoveTo(this.currentColors, colors) // rgb color;
                } else {
                  if (!this.colorFixed) {
                    this.colors = SubRotate.pointMoveTo(this.currentColors, centerID, Config.get('centerColor')) // rgb color;
                    this.colorFixed = true
                  }
                  this.currentColors = this.colors
                }
                        // Basic.printArray(this.currentColors)
                        // Step 3:   inform others about the map
                let mapHasChanged = !this.newData || this.zoomed
                this.informOthers('SubMapCollectionView__UpdateMap', {
                  mapChanged: mapHasChanged,
                  colors: mapHasChanged ? this.currentColors : this.colors,
                  clusters: this.currentCls.clusters,
                  selections: null,
                  codes: this.fCodes.codes,
                  dimensions: this.collection.dimensions,
                  dimIndeces: this.fCodes.dimIndeces,
                  dataIndeces: this.fCodes.dataIndeces
                })
                this.newData = false
                        // Step 4:   handle the visibility issue
                let gridScales = this.scales
                let centerPosition = [(gridScales.x.range()[1] + gridScales.x.range()[0]) * 0.5, (gridScales.y.range()[1] + gridScales.y.range()[0]) * 0.5]
                let viewSize = [gridScales.x.range()[1] - gridScales.x.range()[0], gridScales.y.range()[1] - gridScales.y.range()[0]]
                let df4Zoom = $.Deferred()
                let df4OldMap = $.Deferred()
                let coordsRange = theMap.coordsRange
                coordsRange = Math.max(coordsRange.x.max - coordsRange.x.min, coordsRange.y.max - coordsRange.y.min)
                this.glyphSize = viewSize[0] * theMap.cellRadius / coordsRange
                if (!this.isNew) {
                  let animationTime = this.visible.toLevel([0, 0], 0, this.transition.duration)
                  setTimeout(() => {
                    df4Zoom.resolve()
                  }, animationTime)
                } else {
                  df4Zoom.resolve()
                }
                        // Step 5:   render the map
                $.when(df4Zoom).done(() => {
                  this.d3el.select('.SubMapTiling').classed('SubMapTiling', false).classed('SubOldTiling', true)
                  this.visible = Visibility(this, centerPosition, viewSize[0], this.glyphSize, this.currentCls.level, this.currentColors, this.transition.duration)
                  let container = this.visible.prepareContainer(this.d3el)
                  this.renderMap(df4OldMap, container, theMap)
                })
                        // Step 6:   render the cluster contours
                $.when(df4OldMap).done(() => {
                  this.showClusters(theMap, gridScales)
                  this.visible.update([0, 0], 1.0)
                  this.clsColorReady = true
                  this.updateClusterInfo()
                  this.isNew = false
                  df.resolve()
                })
              }, // end of showTiling

              hideClusters: function (v_delete, v_duration, v_show = false) {
                if (v_delete) {
                  this.d3el
                                .selectAll('.SubMapClusters')
                                .classed('SubMapClusters', false)
                                .classed('SubOldClusters', true)
                                .attr('opacity', function () {
                                  let t_opc = d3.select(this).attr('opacity')
                                  return t_opc == null ? 0.5 : t_opc
                                })
                                .interrupt()
                                .transition()
                                .duration(v_duration)
                                .attr('opacity', 0)
                                .remove()
                } else {
                  if (v_show) {
                                // show cluster map
                  } else {
                    setTimeout(() => {
                      this.d3el
                                        .selectAll('.SubMapClusters')
                                        .attr('display', 'none')
                    }, durationLong)
                  }
                }
              },

              moveGrids: function (
                        v_grids,
                        v_scales,
                        v_colors,
                        v_glyphSize,
                        v_duration
                    ) {
                console.error('YOU SHALL NOT PASS!')
                let t_transIndeces = this.mapTransition.tranIndeces
                this.d3el
                            .selectAll('.SubMapGridRows')
                            .classed('SubMapGridRows', false)
                            .classed('SubOldRows', true)
                this.d3el
                            .selectAll('.SubMapGrids')
                            .classed('SubMapGrids', false)
                            .classed('SubOldGrids', true)
                this.d3el
                            .selectAll('.SubOldGrids')
                            .filter(function (v_d) {
                              let t_id = parseInt(v_d.id)
                              if (t_transIndeces.has(t_id)) {
                                d3.select(this).classed('match', true)
                                return false
                              } else {
                                let t_opc = d3.select(this).attr('opacity')
                                if (t_opc == null) {
                                  d3.select(this).attr('opacity', 0.2)
                                }
                                return true
                              }
                            })
                            .interrupt()
                            .transition()
                            .duration(v_duration)
                            .attr('opacity', 0)
                            .remove()
                let t_origGlyphSize = parseFloat(
                                this.d3el.select('.SubOldGrids.match').attr('gSize')
                            ),
                  t_zoomScale = v_glyphSize / t_origGlyphSize
                this.d3el
                            .selectAll('.SubOldGrids.match')
                            .interrupt()
                            .transition()
                            .duration(v_duration)
                            .ease('linear')
                            .attr('transform', function (v_d, v_i) {
                              let t_oldID = parseInt(v_d.id),
                                t_newID = t_transIndeces.get(t_oldID),
                                t_cords = v_grids.findGridByID(t_newID),
                                t_grid = v_grids[t_cords[0]][t_cords[1]],
                                t_pos = Basic.scale(v_scales, t_grid.pos),
                                t_col = v_colors[t_newID]
                              t_col = [~~(255 * t_col[0]), ~~(255 * t_col[1]), ~~(255 * t_col[2])]
                              t_col = 'rgb(' + t_col + ')'
                              d3
                                    .select(this)
                                    .select('path')
                                    .interrupt()
                                    .transition()
                                    .duration(v_duration)
                                    .attr('fill', t_col)
                              return 'translate(' + t_pos + ')scale(' + t_zoomScale + ')'
                            })
                            .attr('opacity', 0)
                            .remove()
                setTimeout(() => {
                  this.d3el.selectAll('.SubOldTiling').remove()
                }, v_duration + 20)
              },

              getContourTree: function (map, clusterIndices, contourTree, currentLevel, previousPath, idOThis) {
                let cluster = []
                let outlier = []
                let returnedCluster = []
                for (let i = 0; i < clusterIndices.length; i++) {
                  if (clusterIndices[i].length != null) {
                    let simpleCluster
                    let previousID = previousPath.slice(0)
                    previousID.push(i)
                    simpleCluster = this.getContourTree(map, clusterIndices[i], contourTree, currentLevel + 1, previousID, i)
                    cluster.push(simpleCluster)
                    returnedCluster.push(...simpleCluster)
                  } else {
                    returnedCluster.push(clusterIndices[i])
                    outlier.push(clusterIndices[i])
                  }
                }
                if (cluster.length > 0) {
                  let paths = map.getClusterContours(cluster)
                  contourTree[currentLevel].push({
                    previous: previousPath,
                    selfID: idOThis + '',
                    paths: paths,
                    ids: cluster,
                    outlier: false
                  })
                }
                return returnedCluster
              }, // end of getContourTree

              renderPaths: function (clusterIndicesPaths, classNames, previousPath, isOutlier, scales) {
                let interactions = this.interactions
                let clusterLevel = previousPath.length
                let cluster = this.d3el
                            .select('.SubMapTiling')
                            .selectAll('.' + classNames)
                            .data(clusterIndicesPaths)
                            .enter()
                            .append('g')
                            .attr('class', (d, index) => {
                              return 'SubMapClusters ' + classNames + '_' + index + (isOutlier ? ' Outliers' : '')
                            })
                            .attr('clsID', (d, index) => {
                              return [...previousPath, index].join('_')
                            })
                            .attr('fill-opacity', 0.0)
                            .on('mouseover', function (d, index) {
                              let clusterID = d3.select(this).attr('clsID')
                              if (interactions.hoveredID !== clusterID) {
                                interactions.hoveredID = clusterID
                                interactions.mouseOver(this, isOutlier)
                              }
                            })
                            .on('mouseout', (d, index) => {
                              interactions.hoveredID = null
                              interactions.mouseOut(isOutlier)
                            })
                            .on('click', function (d, index) {
                              Basic.delay('clickPinning', 400, () => {
                                interactions.pinning(this)
                              })
                            })
                            .on('dblclick', (d, index) => {
                              Basic.clearDelay('clickPinning')
                              if (!isOutlier) {
                                this.visible.toLevel(d.center, d.clsLevel + 1, this.transition.long)
                              }
                            })
                let renderFunction = function (edge, index) {
                  let startCoordinates = [edge.start.coordinates.x, edge.start.coordinates.y]
                  let endCoordinates = [edge.end.coordinates.x, edge.end.coordinates.y]
                  let start = Basic.scale(scales, startCoordinates)
                  let end = Basic.scale(scales, endCoordinates)
                  let line = [start, end].join('_')
                  d3.select(this)
                                .attr('pos', line)
                                .selectAll('line')
                                .data([edge])
                                .enter()
                                .append('line')
                                .attr('x1', start[0])
                                .attr('y1', start[1])
                                .attr('x2', end[0])
                                .attr('y2', end[1])
                                .attr('stroke', '#666')
                }
                cluster.call(clsContainers => {
                  clsContainers[0].forEach(clsContainer => {
                    let clusterPaths = d3.select(clsContainer).data()[0]
                    let paths = []
                    let rangePath = []
                    let rangePts
                    let diameter = 0
                                // draw block paths
                    for (let i = 0; i < clusterPaths.paths.length; i++) {
                      let clusterPath = clusterPaths.paths[i]
                      let pathPoints = clusterPath.points
                      let startPoint = Basic.scale(scales, [pathPoints[0].coordinates.x, pathPoints[0].coordinates.y])
                      let path = 'M' + startPoint
                      for (let j = 1; j < pathPoints.length; j++) {
                        let point = Basic.scale(scales, [pathPoints[j].coordinates.x, pathPoints[j].coordinates.y])
                        path += ' L' + point
                        rangePath.push(point)
                      }
                      if (clusterPath.closed) {
                        path += 'L' + startPoint
                      }
                      paths.push(path)
                    }
                    for (let i = 0; i < rangePath.length - 1; i++) {
                      for (let j = i + 1; j < rangePath.length; j++) {
                        let distance = Basic.getDistance(rangePath[i], rangePath[j])
                        if (distance > diameter) {
                          diameter = distance
                          rangePts = [i, j]
                        }
                      }
                    }
                    for (let i = 0; i < rangePts.length; i++) {
                      rangePts[i] = rangePath[rangePts[i]]
                    }
                    clusterPaths.center = Basic.getMeanVector(rangePts, false)
                    clusterPaths.diameter = diameter
                    clusterPaths.clsLevel = clusterLevel
                    d3.select(clsContainer)
                                    .selectAll('path')
                                    .data(paths)
                                    .enter()
                                    .append('path')
                                    .attr('d', p => { return p })
                                // draw edge lines
                    if (!d3.select(clsContainer).classed('Outliers')) {
                      d3.select(clsContainer)
                                        .append('g')
                                        .attr('class', 'SubClsPaths')
                                        .selectAll('.SubClsPath')
                                        .data(clusterPaths.lines)
                                        .enter()
                                        .append('g')
                                        .attr('class', 'SubClsPath')
                                        .each(renderFunction)
                    }
                  })
                })
              }, // end of renderPaths

              showClusters: function (map, scales) {
                let clusterPaths = []
                let levels = this.currentCls.level
                if (!this.zoomed && this.overallCls.paths != null) {
                  clusterPaths = this.currentCls.paths
                } else {
                  let cluster = this.currentCls.clusters
                  for (let i = 0; i < levels; i++) {
                    clusterPaths.push([])
                  }
                  this.getContourTree(map, cluster, clusterPaths, 0, [], null)
                  this.currentCls.paths = clusterPaths
                }
                for (let i = clusterPaths.length; i > 0; i--) {
                  let clusterLevel = clusterPaths[i - 1]
                  for (let j = 0; j < clusterLevel.length; j++) {
                    let pathData = clusterLevel[j]
                    this.renderPaths(pathData.paths, 'SubCls' + pathData.previous.join('_'), pathData.previous, pathData.outlier, scales)
                  }
                }
                this.updateClusterInfo()
              }, // end of showClusters

              updateClusterInfo: function (v_init = true) {
                if (!this.clsColorReady) {
                  return
                }
                if (v_init) {
                  let t_initClsProjections = () => {
                    let t_centers = new Array(),
                      t_aggr = this.currentCls.aggregate,
                      t_tree = this.collection.subTree,
                      t_findCol = v_clsIDs => {
                        let t_visibleList = this.currentCls.visible[
                                                v_clsIDs.length - 1
                                            ],
                          t_clsID = v_clsIDs.join('_'),
                          t_visibleItem = t_visibleList.filter(v_visibleItem => {
                            return v_visibleItem.clsID == t_clsID
                          })[0]
                        return t_visibleItem.avgCol
                      },
                      t_findWeight = v_clsIDs => {
                        let t_children = t_aggr
                        for (let i = 0; i < v_clsIDs.length; i++) {
                          t_children = t_children[v_clsIDs[i]]
                        }
                                        // test here
                                        /*              let t_weights = t_children.supernode.nghDims */
                        let t_weights = t_children.supernode.dimensions
                                        /*              t_weights = numeric.div(t_weights, Math.max(...t_weights)) */
                        return t_weights
                      }
                    let t_collection = this.collection
                    this.d3el.selectAll('.SubMapClusters').each(function (t_d) {
                      let t_this = d3.select(this),
                        t_outliers = t_this.classed('Outliers')
                      if (t_outliers) {
                        return
                      }
                      let t_clsID = t_this.attr('clsID').split('_'),
                        t_subTree = t_collection.subTree.findByIndex(t_clsID),
                        t_weights = t_subTree.data.dataWeights,
                        t_ovlWeights =
                                        this.ovlDataWeights == undefined
                                        ? t_collection.subTree.data.dataWeights
                                        : this.ovlDataWeights
                      t_weights = numeric.sub(t_weights, t_ovlWeights)
                      let t_cid = t_clsID.length - 1,
                        t_info = {
                          center: t_d.center,
                          clsID: t_clsID,
                          color: t_findCol(t_clsID),
                          count: t_tree.findByIndex(t_clsID).dictionary.length,
                          weights: t_findWeight(t_clsID),
                          data: t_weights
                        }
                      if (t_centers[t_cid] == undefined) {
                        t_centers[t_cid] = []
                      }
                      t_centers[t_cid].push(t_info)
                    })
                    this.informOthers('SubMapCollectionView__InitClusters', t_centers)
                  }
                  t_initClsProjections()
                } else {
                  let t_updateClsProjections = () => {
                    let t_centers = new Array(),
                      t_aggr = this.currentCls.aggregate,
                      t_tree = this.collection.subTree,
                      t_findVisible = v_clsIDs => {
                        let t_visibleList = this.currentCls.visible[v_clsIDs.length - 1]
                        let t_clsID = v_clsIDs.join('_')
                        let t_visibleItem = t_visibleList.filter(v_visibleItem => {
                          return v_visibleItem.clsID == t_clsID
                        })[0]
                        return t_visibleItem.visible
                      }
                    this.d3el.selectAll('.SubMapClusters').each(function (t_d) {
                      let t_this = d3.select(this),
                        t_outliers = t_this.classed('Outliers')
                      if (t_outliers) {
                        return
                      }
                      let clsID = t_this.attr('clsID').split('_')
                      let cid = clsID.length - 1
                      let info = {
                        clsID: t_this.attr('clsID'),
                        visible: t_findVisible(clsID)
                      }
                      if (t_centers[cid] === undefined) {
                        t_centers[cid] = []
                      }
                      t_centers[cid].push(info)
                    })
                    this.informOthers(
                                    'SubMapCollectionView__UpdateClusters',
                                    t_centers
                                )
                  }
                  t_updateClsProjections()
                }
              },

              bindTuning: function () {
                $('#Pattern').on('click', () => {
                  if (this.patternSign) {} else {
                    this.patternSign = true
                    setTimeout(() => {
                      this.patternSign = false
                    }, 200)
                    let container = d3.selectAll('.SubMapGrids')
                    this.pattern = !this.pattern
                    SubGlyph.changeGlyph(container, this.pattern, this.nghDims)
                    if (this.pattern) {
                      $('#Pattern #text').text('Hide Pattern')
                    } else {
                      $('#Pattern #text').text('Show Pattern')
                    }
                  }
                })
              }, // end of bindTuning

              aggregate: function () {
                class t_clsInfoObj {
                  constructor (
                                v_prevObj,
                                v_treePath,
                                v_isOut = false,
                                v_nghPatterns,
                                v_aggrDims
                            ) {
                    let t_nghPatterns = new Map(),
                      t_prevPatterns = v_prevObj ? v_prevObj.patterns : null,
                      t_aggrDims = new Array(t_dimCount).fill(0),
                      t_prevDims = v_prevObj ? v_prevObj.dimensions : null,
                      t_treePath = new Array()
                    this.dimensions =
                                    v_aggrDims == null ? t_prevDims || t_aggrDims : v_aggrDims
                    this.patterns =
                                    v_nghPatterns == null
                                    ? t_prevPatterns || t_nghPatterns
                                    : v_nghPatterns
                    this.index = v_treePath == null ? t_treePath : v_treePath
                    this.outliers = v_isOut
                  }
                  combineWith (v_clsInfoObj) {
                    let t_combineValues = (v_count_i, v_count_j) => {
                      return v_count_i + v_count_j
                    }
                    this.dimensions = numeric.add(
                                    this.dimensions,
                                    v_clsInfoObj.dimensions
                                )
                    this.patterns = Basic.combineMaps(
                                    this.patterns,
                                    v_clsInfoObj.patterns,
                                    t_combineValues
                                )
                  }
                        }
                let t_subTreeFunc = (v_subNodes, v_treePath) => {
                    if (v_subNodes.length == 1) {
                      let t_clsInfo = new t_clsInfoObj(
                                        v_subNodes[0].supernode,
                                        v_treePath
                                    )
                      return t_clsInfo
                    }
                    let t_clsInfo = new t_clsInfoObj(null, v_treePath)
                    if (v_subNodes.length == 0) {
                      return t_clsInfo
                    }
                    for (let i = 0; i < v_subNodes.length; i++) {
                      t_clsInfo.combineWith(v_subNodes[i].supernode)
                    }
                    return t_clsInfo
                  },
                  t_leavesFunc = (v_leaves, v_onlyLeaves, v_treePath) => {
                    let t_clsInfo = new t_clsInfoObj(
                                        null,
                                        v_treePath, !v_onlyLeaves
                                    ),
                      t_patternMap = t_clsInfo.patterns,
                      t_dimensions = t_clsInfo.dimensions
                    for (let i = 0; i < v_leaves.length; i++) {
                      let t_ind = v_leaves[i],
                        t_nghs = t_nghList[t_ind],
                        tt_code_i = t_codes[t_ind]
                                    // collect dimension patterns (i.e. local dim weights)
                      for (let j = 0; j < t_nghs.length; j++) {
                        let t_ngh = t_nghs[j],
                          tt_code_j = t_codes[t_ngh],
                          t_extDims = t_maskMap.findPair(t_ind, t_ngh),
                          t_nghDims
                        if (t_extDims == null) {
                          t_nghDims = new Array(t_dimCount).fill(0)
                          for (let k = 0; k < tt_code_i.length; k++) {
                            if (tt_code_i[k] == tt_code_j[k]) {
                              t_nghDims[k] = 1
                            }
                          }
                          t_nghDims = t_nghDims.join('')
                          t_maskMap.setPair(t_ind, t_ngh, t_nghDims)
                        } else {
                          t_nghDims = t_extDims
                        }
                        if (!t_patternMap.has(t_nghDims)) {
                          t_patternMap.set(t_nghDims, 0)
                        }
                        t_patternMap.set(
                                            t_nghDims,
                                            t_patternMap.get(t_nghDims) + 1
                                        )
                      }
                                    // collect dimension counts
                      for (let j = 0; j < tt_code_i.length; j++) {
                        if (tt_code_i[j] == 1) {
                          t_dimensions[j]++
                        }
                      }
                    }
                    return {
                      supernode: t_clsInfo,
                      leafnode: v_leaves
                    }
                  }
                let t_codes = this.fCodes.codes,
                  t_nghList = this.fMatrix.neighbors,
                  t_subNum = t_codes.length,
                  t_dimCount = t_codes[0].length,
                  t_ovlNghDims = Basic.initArray(t_subNum, t_dimCount), // ovlNghDims: local dim weights of each subspace
                  t_maskMap = new Map() // shared dimensions in each pair of ngh subspaces
                t_maskMap.findPair = function (v_i, v_j) {
                  let t_key = v_i < v_j ? v_i + '_' + v_j : v_j + '_' + v_i
                  return this.get(t_key)
                }
                t_maskMap.setPair = function (v_i, v_j, v_mask) {
                  let t_key = v_i < v_j ? v_i + '_' + v_j : v_j + '_' + v_i
                  for (let k = 0; k < v_mask.length; k++) {
                    if (v_mask[k] == '1') {
                      t_ovlNghDims[v_i][k]++
                      t_ovlNghDims[v_j][k]++
                    }
                  }
                  return this.set(t_key, v_mask)
                }
                let t_aggrClsTree = (this.currentCls.aggregate = Basic.traverseTree(
                            this.currentCls.clusters,
                            t_subTreeFunc,
                            t_leavesFunc
                        ))
                t_ovlNghDims.extent = Basic.extArray(t_ovlNghDims)
                this.nghDims = t_ovlNghDims
                let t_dimNum = this.nghDims[0].length
                let t_simpleTree = v_tree => {
                  let t_result = new Array(t_dimNum).fill(0)
                  for (let i = 0; i < v_tree.length; i++) {
                    let t_child_result = new Array(t_dimNum).fill(0)
                    if (typeof v_tree[i][0] === 'object') {
                      t_child_result = t_simpleTree(v_tree[i])
                    } else {
                      for (let j = 0; j < v_tree[i].length; j++) {
                        t_child_result = numeric.add(
                                            t_child_result,
                                            t_ovlNghDims[v_tree[i][j]]
                                        )
                      }
                      v_tree[i].supernode.nghDims = t_child_result
                    }
                    t_result = numeric.add(t_result, t_child_result)
                  }
                  v_tree.supernode.nghDims = t_result
                  return t_result
                }
                t_simpleTree(t_aggrClsTree)
                        // this.aggregateTree = t_aggregate;
                        // t_aggregate = Basic.mapToArray(this.aggregate, "entries");
                        // let t_aggrMax = -Infinity, t_aggrMin = Infinity;
                        // for(let i = 0; i < t_aggregate.length; i++){
                        //     if(eval(t_aggregate[i][0].split("").join("+")) == 1){
                        //         continue;
                        //     }
                        //     if(t_aggregate[i][1] > t_aggrMax){
                        //         t_aggrMax = t_aggregate[i][1];
                        //     }
                        //     if(t_aggregate[i][1] < t_aggrMin){
                        //         t_aggrMin = t_aggregate[i][1];
                        //     }
                        // }
                        // return [t_aggrMin, t_aggrMax];
              },

              showGrids: function () {
                var self = this,
                  t_scales = self.parameter.scales,
                  t_dims = self.collection.dimCount
                var t_grids = [],
                  t_gridScale,
                  t_gridSize
                var t_projection = self.collection.projection
                var initGrids = function (v_num, v_grids) {
                  var t_xNum = v_num,
                    t_xLength = 1 / t_xNum,
                    t_yLength = t_xLength * Math.sqrt(3) / 2,
                    t_yTop = t_xLength * Math.sqrt(3) / 3,
                    t_yNum = Math.floor(1 / t_yLength)
                  var t_gridSize = t_xLength / 2
                  for (var i = 0; i < t_yNum; i++) {
                    var tt_grids = []
                    for (var j = 0; j < t_xNum; j++) {
                      var t_cords = [
                        ((i % 2 == 1 ? 1 : 0.5) + j) * t_xLength,
                        t_yTop + i * t_yLength
                      ]
                      var tt_grid = {
                        count: 0,
                        cords: t_cords,
                        dims: new Array(t_dims).fill(0)
                      }
                      tt_grids.push(tt_grid)
                    }
                    v_grids.push(tt_grids)
                  }
                  var t_getDist = function (vv_x, vv_y, vv_cords) {
                    var tt_cords = v_grids[vv_y][vv_x].cords
                    return {
                      index: [vv_y, vv_x],
                      dist: Math.pow(tt_cords[0] - vv_cords[0], 2) +
                                        Math.pow(tt_cords[1] - vv_cords[1], 2)
                    }
                  }
                  var t_gridScale = function (vv_x, vv_y) {
                    var tt_y = vv_y < t_yTop ? 0 : (vv_y - t_yTop) / t_yLength,
                      tt_x
                    var tt_yf = Math.floor(tt_y),
                      tt_yc = Math.ceil(tt_y)
                    if (tt_yf == tt_yc) {
                      if (tt_yf % 2 == 0) {
                        tt_x = Math.floor(vv_x / t_xLength)
                      } else {
                        tt_x =
                                            vv_x < t_xLength / 2
                                            ? 0
                                            : Math.floor(vv_x / t_xLength - 0.5)
                      }
                    } else {
                      var ttt_odd,
                        ttt_even,
                        ttt_dists = []
                      if (tt_yf % 2 == 0) {
                        ttt_odd = tt_yc
                        ttt_even = tt_yf
                      } else {
                        ttt_odd = tt_yf
                        ttt_even = tt_yc
                      }
                      var ttt_x = Math.floor(vv_x / t_xLength)
                      if (ttt_x == 0) {
                        tt_x = 0
                        ttt_dists[0] = t_getDist(0, ttt_odd, [vv_x, vv_y])
                        ttt_dists[1] = t_getDist(0, ttt_even, [vv_x, vv_y])
                        if (ttt_dists[0].dist < ttt_dists[1].dist) {
                          tt_y = ttt_odd
                        } else {
                          tt_y = ttt_even
                        }
                      } else {
                        if (ttt_x == t_xNum) {
                          ttt_x = t_xNum - 1
                        }
                        if (ttt_odd == t_yNum) {
                          ttt_odd--
                        }
                        if (ttt_even == t_yNum) {
                          ttt_even--
                        }
                        if (ttt_even < t_yNum) {
                          ttt_dists.push(
                                                t_getDist(ttt_x - 1, ttt_even, [vv_x, vv_y])
                                            )
                          ttt_dists.push(t_getDist(ttt_x, ttt_even, [vv_x, vv_y]))
                          if (ttt_x < t_xNum - 1) {
                            ttt_dists.push(
                                                    t_getDist(ttt_x + 1, ttt_even, [vv_x, vv_y])
                                                )
                          }
                        }
                        if (ttt_odd < t_yNum) {
                          ttt_dists.push(t_getDist(ttt_x, ttt_odd, [vv_x, vv_y]))
                          if (ttt_x < t_xNum - 1) {
                            ttt_dists.push(
                                                    t_getDist(ttt_x + 1, ttt_odd, [vv_x, vv_y])
                                                )
                          }
                        }
                        ttt_dists.sort(function (a, b) {
                          return a.dist - b.dist
                        })
                        tt_x = ttt_dists[0].index[1]
                        tt_y = ttt_dists[0].index[0]
                      }
                    }
                    return [tt_y, tt_x]
                  }
                  return {
                    scale: t_gridScale,
                    size: t_gridSize
                  }
                }
                var aggrGrids = function (v_points, v_grids, v_gridScale) {
                  var t_indeces = self.collection.subIndex
                  for (var i = 0; i < v_points.length; i++) {
                    var t_gridCords = v_gridScale(v_points[i][0], v_points[i][1]),
                      t_i = t_gridCords[0],
                      t_j = t_gridCords[1]
                    v_grids[t_i][t_j].count++
                    v_grids[t_i][t_j].dims = numeric.add(
                                    v_grids[t_i][t_j].dims,
                                    t_indeces[i]
                                )
                  }
                  for (var i = 0; i < v_grids.length; i++) {
                    for (var j = 0; j < v_grids[0].length; j++) {
                      var t_count = v_grids[i][j].count
                      if (t_count > 0) {
                        v_grids[i][j].dims = numeric.div(
                                            v_grids[i][j].dims,
                                            t_count
                                        )
                      }
                    }
                  }
                }
                var showGlyph = function (v_g, v_r, v_dims, v_maxR) {
                  var t_factor = 2 * Math.sqrt(3) / 3,
                    t_maxR = v_maxR * t_factor,
                    t_r = v_r * t_factor
                  v_g
                                .append('path')
                                .attr('d', d3.hexbin().hexagon(t_r))
                                .classed('cell', true)
                  if (v_r > 0) {
                    var t_div = Math.PI * 2 / v_dims.length
                    for (var i = 0; i < v_dims.length; i++) {
                      var tt_ang = t_div * i
                      v_g
                                        .append('line')
                                        .attr('class', 'weights')
                                        .attr('x1', 0)
                                        .attr('y1', 0)
                                        .attr('x2', v_maxR * 0.8 * v_dims[i] * Math.cos(tt_ang))
                                        .attr('y2', v_maxR * 0.8 * v_dims[i] * Math.sin(tt_ang))
                    }
                  }
                  v_g
                                .append('path')
                                .attr('d', d3.hexbin().hexagon(t_maxR))
                                .classed('frame', true)
                                .classed('light', v_r == 0)
                }
                var drawGrids = function (v_g, v_grids, v_gridSize, v_scales) {
                  var tt_max = 0,
                    tt_min = Infinity
                  for (var i = 0; i < v_grids.length; i++) {
                    for (var j = 0; j < v_grids[0].length; j++) {
                      var ttt_count = v_grids[i][j].count
                      if (ttt_count > tt_max) {
                        tt_max = ttt_count
                      }
                      if (ttt_count < tt_min) {
                        tt_min = ttt_count
                      }
                    }
                  }
                  var t_rSize =
                                (v_scales.x.range()[1] - v_scales.x.range()[0]) /
                                v_grids[0].length *
                                0.5
                  var tt_rscale = d3.scale
                                .linear()
                                .domain([tt_min, tt_max])
                                .range([0, t_rSize])
                  var tt_g = v_g.append('g').classed('SubMapGrids', true)
                  for (var i = 0; i < v_grids.length; i++) {
                    var tt_jlength = v_grids[0].length - (i % 2 == 1 ? 1 : 0)
                    for (var j = 0; j < tt_jlength; j++) {
                      var tt_pos = Basic.scale(v_scales, v_grids[i][j].cords)
                      var ttt_g = tt_g
                                        .append('g')
                                        .classed('SubMapGrid', true)
                                        .attr('id', 'SubMapGrid_' + i + '_' + j)
                                        .attr('transform', 'translate(' + tt_pos + ')')
                      showGlyph(
                                        ttt_g,
                                        tt_rscale(v_grids[i][j].count),
                                        v_grids[i][j].dims,
                                        t_rSize
                                    )
                    }
                  }
                }
                var t_gridsReturn = initGrids(Config.get('gridNumber'), t_grids)
                t_gridScale = t_gridsReturn.scale
                t_gridSize = t_gridsReturn.size
                aggrGrids(t_projection, t_grids, t_gridScale)
                drawGrids(self.d3el, t_grids, t_gridSize, t_scales)
              },

              showProjection: function () {
                var self = this,
                  t_projection = self.collection.projection,
                  t_scales = self.parameter.scales,
                  t_r = self.parameter.r,
                  t_colors = self.collection.colors
                self.d3el
                            .append('g')
                            .classed('SubMapModels', true)
                            .selectAll('.SubMapModel')
                            .data(self.collection.models)
                            .enter()
                            .append('g')
                            .classed('SubMapModel', true)
                            .attr('id', function (t_d) {
                              return 'SubMapModel_' + t_d.id
                            })
                            .attr('transform', function (t_d) {
                              var t_ind = t_d.id,
                                t_pos = t_projection[t_ind]
                              return 'translate(' + Basic.scale(t_scales, t_pos) + ')'
                            })
                            .on('click', function (t_d) {
                              self.collection.trigger('Transmission', {
                                type: 'trans',
                                message: 'SubMapCollectionView__ShowProjection',
                                data: t_d.subspace
                              })
                            })
                            .append('circle')
                            .attr('cx', 0)
                            .attr('cy', 0)
                            .attr('r', t_r)
                            .attr('fill', function (t_d) {
                                // var t_ind = t_d.id, t_col = t_colors[t_ind];
                                // t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                                // return "rgb(" + t_col + ")";
                              return '#000'
                            })
                            .append('title')
                            .text(function (t_d) {
                              return t_d.code
                            })
              },

              showModels: function () {
                let t_td = this.collection.tpModel.TDims,
                  t_scales = this.scales,
                  t_r = this.r
                let t_m = numeric.transpose(this.collection.tpModel.DTMatrix),
                  t_sum = numeric.sum(t_m)
                let t_arc = d3.svg.arc(),
                  t_ratio = 3
                let t_g = this.d3el
                            .selectAll('.SubMapTopics')
                            .data(t_td)
                            .enter()
                            .append('g')
                            .classed('SubMapTopics', true)
                            .attr('transform', function (t_d, t_i) {
                              let t_pos = [1.1, t_i * 1 / (t_td.length + 1)]
                              return 'translate(' + Basic.scale(t_scales, t_pos) + ')'
                            })
                t_g
                            .append('circle')
                            .attr('cx', 0)
                            .attr('cy', 0)
                            .attr('r', function (t_d, t_i) {
                              return t_r * t_ratio * 1.5 * numeric.sum(t_m[t_i]) / t_sum
                            })
                            .attr('fill', '#000')
                            .on('mouseover', function (t_d, t_i) {
                              d3
                                    .select($(this).parent()[0])
                                    .selectAll('path')
                                    .attr('stroke-width', 3)
                              d3.selectAll('.SubMapModel').attr('opacity', function () {
                                let t_id = $(this)
                                        .attr('id')
                                        .replace('SubMapModel_', ''),
                                  t_sum = numeric.sum(t_m[t_i])
                                let t_mx = _.max(t_m[t_i]),
                                  t_mn = _.min(t_m[t_i]),
                                  t_w = (t_m[t_i][t_id] - t_mn) / (t_mx - t_mn)
                                return t_w
                              })
                            })
                            .on('mouseout', function () {
                              d3
                                    .select($(this).parent()[0])
                                    .selectAll('path')
                                    .attr('stroke-width', 1)
                              d3.selectAll('.SubMapModel').attr('opacity', 1)
                            })
                let t_step = Math.PI * 2 / t_td[0].length
                for (let i = 0; i < t_td[0].length; i++) {
                  t_g
                                .append('path')
                                .attr('d', function (t_d) {
                                  t_arc
                                        .startAngle(i * t_step)
                                        .endAngle((i + 1) * t_step)
                                        .innerRadius(t_r * t_ratio)
                                        .outerRadius(t_r * t_ratio * (1 + 2 * t_d[i]))
                                  return t_arc()
                                })
                                .attr('stroke', '#000')
                                .attr('fill', 'none')
                }
              },

              clearAll: function () {
                this.d3el.selectAll('g').remove()
                let t_clean = {
                  dimCover: new Array(this.collection.dimCount).fill(-1),
                  distMat: null,
                  diffMat: null,
                  distExt: null,
                  nghList: null,
                  zoomed: false,
                  newData: true,
                  glyphSize: null,
                  visible: null,
                  pattern: false,
                  patternSign: false,
                  nghDims: null,
                  freeDim: null,
                  fCodes: null,
                  fMatrix: null,
                  colors: null,
                  currentColors: null,
                  colorFixed: false,
                  transition: Config.get('transition'),
                  overallCls: {
                    clusters: null,
                    level: null,
                    paths: null,
                    aggregate: null,
                    visible: null
                  },
                  currentCls: {
                    clusters: null,
                    level: null,
                    paths: null,
                    aggregate: null,
                    visible: null
                  },
                  isNew: true,
                  overallMap: null,
                  mapTransition: {
                    indeces: null, // old indeces
                    tranIndeces: null, // transition from old to current indeces
                    nameBook: null, // original id to current indeces
                    colors: null
                  },
                  clsColorReady: false
                }
                Object.assign(this, t_clean)
                $('#Pattern #text').text('Show Pattern')
              },

              clearCanvas: function () {
                this.collection.trigger('Transmission', {
                  type: 'trans',
                  message: 'SubMapCollectionView__ClearProjection',
                  data: null
                })
                        // }, t_time);
              }
            },
                Base
            )
        )

      return SubMap_CollectionView
    }
)
