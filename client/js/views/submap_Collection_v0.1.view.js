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
                    let targetIDs
                    if (ids != null) {
                      if (isTranslate) {
                        targetIDs = thisView.getClsByPath(ids)
                      } else {
                        targetIDs = ids
                      }
                    }
                    let message
                    if (isPin) {
                      this.projectByIDs(targetIDs)
                      message = 'SubMapCollectionView__Pin'
                    } else {
                      message = 'SubMapCollectionView__Choose'
                    }
                    thisView.informOthers(message, {
                      attr: 'index',
                      IDs: targetIDs,
                      weights: dataWeights,
                      inform: false
                    })
                  } // end of interactions.informOthers
                  interactions.pinning = function (thisContainer, isBlock = true) {
                    let targetSelection = d3.select(thisContainer)
                    let pinned = targetSelection.classed('pinned')
                    let targetIDs
                    d3el.selectAll('.SubMapClusters.pinned').classed('pinned', false)
                    if (!pinned) {
                      if (isBlock) {
                        targetIDs = thisView.getClsByPath.call(thisView, targetSelection.attr('clsID').split('_'))
                        targetIDs = SubGlyph.pickGlyphsByIDs(d3el, targetIDs, 'index')
                        targetSelection.classed('pinned', true)
                      } else {
                        targetIDs = [targetSelection.attr('index')]
                        targetIDs = SubGlyph.pickGlyphsByIDs(d3el, targetIDs, 'index')
                      }
                    } else {
                      SubGlyph.pickGlyphsByIDs(d3el, null, 'index')
                                    // targetSelection.classed("pinned", false);
                    }
                    this.informOthers(targetIDs, null, false, true)
                  } // end of interactions.pinning
                  interactions.filterByDims = function (filterSettings) {
                    let returnedData = {
                      indeces: SubGlyph.filterGlyphsByDims(d3el, filterSettings, 'index'),
                      illegal: filterSettings.filter(d => { return d !== 0 }).length < 2
                    }
                    thisCollection.trigger('Transmission', {
                      type: 'trans',
                      message: 'SubMapCollectionView__Filtering',
                      data: returnedData
                    })
                  } // end of interactions.filterByDims
                  interactions.filterByIDs = function (targetIDs) {
                    return SubGlyph.filterGlyphsByIDs(d3el, targetIDs, 'index')
                  } // end of interactions.filterByIDs
                  interactions.pinByIDs = function (targetIDs) {
                    d3el.selectAll('.SubMapClusters.pinned').classed('pinned', false)
                    SubGlyph.pickGlyphsByIDs(d3el, targetIDs)
                    this.projectByIDs(targetIDs)
                  } // end of interactions.pinByIDs
                  interactions.projectByIDs = function (targetIDs) {
                    if (targetIDs == null || targetIDs.length == 0) {
                      thisCollection.trigger('Transmission', {
                        type: 'trans',
                        message: 'SubMapCollectionView__DefaultProjection',
                        data: null
                      })
                    } else {
                      let codeBook = thisCollection.subIndex
                      if (targetIDs.length == 1) {
                        let codesOTarget = codeBook[targetIDs[0]]
                        thisCollection.trigger('Transmission', {
                          type: 'trans',
                          message: 'SubMapCollectionView__ShowProjection',
                          data: this.fixCode(codesOTarget)
                        })
                      } else {
                        let codesOTarget = codeBook[targetIDs[0]]
                        thisCollection.trigger('Transmission', {
                          type: 'trans',
                          message: 'SubMapCollectionView__ShowProjection',
                          data: this.fixCode(codesOTarget)
                        })
                      }
                    }
                  } // interactions.projectByIDs
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

              initVisible: function (
                        v_center,
                        v_ringDiameter,
                        v_glyphSize,
                        v_clsLevel,
                        v_colors
                    ) {
                class visibleObj {
                  constructor (
                                v_this,
                                v_center,
                                v_ringDiameter,
                                v_glyphSize,
                                v_clsLevel,
                                v_colors
                            ) {
                    let t_extent = [1, Math.sqrt(v_clsLevel) + 1],
                      t_maxLevel = Math.log(Math.pow(t_extent[1], 4)) / Math.log(2),
                      t_zoomer = d3.behavior
                                    .zoom()
                                    .translate([0, 0])
                                    .scale(1)
                                    .scaleExtent(t_extent)
                                    .on('zoom', e => {
                                      let t_trans = d3.event.translate,
                                        t_scale = d3.event.scale
                                      d3
                                            .select('.SubMapTiling')
                                            .attr(
                                                'transform',
                                                'translate(' + t_trans + ')scale(' + t_scale + ')'
                                            )
                                      this.update(t_trans, t_scale)
                                    }),
                      t_ctr = t_maxLevel / v_clsLevel
                    this.center = v_center
                    this.diameter = v_ringDiameter
                    this.glyphSize = v_glyphSize
                    this.clsLevel = v_clsLevel
                    this.colors = v_colors
                    this.parent = v_this
                    this.zoom = {
                      extent: t_extent,
                      maxLevel: t_maxLevel,
                      zoomer: t_zoomer
                    }
                    this.container = null
                    this.ctr = t_ctr
                    this.clsToScale = v_clsLevel => {
                      return Math.pow(Math.pow(2, v_clsLevel * t_ctr), 0.25)
                    }
                  }
                  update (v_trans, v_scale, v_duration = t_duration) {
                    let t_level = Math.log(Math.pow(v_scale, 4)) / Math.log(2),
                      t_ctr = this.ctr,
                      t_div = t_ctr * 0.5,
                      t_this = this.parent,
                      t_c2scale = t_this.clsToScale,
                      t_clsPaths = t_this.currentCls.paths,
                      t_scales = t_this.scales,
                      t_ringRRatio = t_this.snapshotPar.ringRRatio,
                      t_transform = BasicView.getTransform(
                                        t_this.d3el.select('.SubMapTiling').attr('transform')
                                    )
                    let t_pointVisible = v_pos => {
                        v_pos[0] = v_pos[0] * v_scale - this.center[0] + v_trans[0]
                        v_pos[1] = v_pos[1] * v_scale - this.center[1] + v_trans[1]
                        let t_pr = Math.sqrt(
                                            v_pos[0] * v_pos[0] + v_pos[1] * v_pos[1]
                                        )
                        return (
                                            t_pr + this.glyphSize * v_scale <=
                                            this.diameter * t_ringRRatio - 8 * 0.9
                        )
                      },
                      t_changeVisible = (
                                        v_selection,
                                        v_visibleFunc,
                                        v_givenOpc = false
                                    ) => {
                        v_selection
                                            .interrupt()
                                            .transition()
                                            .duration(v_duration)
                                            .attr('opacity', function (v_d, v_i) {
                                              let t_visible = v_visibleFunc(this)
                                              if (t_visible) {
                                                d3.select(this).classed('visible', true)
                                                if (v_givenOpc) {
                                                  return t_visible
                                                } else {
                                                  return 1
                                                }
                                              } else {
                                                d3.select(this).classed('visible', false)
                                                return 0
                                              }
                                            })
                      },
                      t_SubClsVisible = v_baseLineFunc => {
                        let t_clsVisibleFunc = v_gCls => {
                          let t_visible
                          if (!d3.select(v_gCls).classed('Outliers')) {
                            let t_clsID = d3
                                                    .select(v_gCls)
                                                    .attr('clsID')
                                                    .split('_'),
                              t_baseline = (t_clsID.length - 1) * t_ctr
                            t_visible =
                                                    t_level >= t_baseline - t_div &&
                                                    t_level < t_baseline + t_div
                            t_clsVisible[t_clsID.length - 1].atLevel = t_visible
                          } else {
                            let t_baseline = (this.clsLevel - 1) * t_ctr
                            t_visible = t_level < t_baseline + t_div
                          }
                          return t_visible
                        }
                        let t_Cls = t_this.d3el.selectAll('.SubMapClusters')
                        t_changeVisible(t_Cls, t_clsVisibleFunc)
                        t_this.d3el
                                            .selectAll('.visible .SubClsPath')
                                            .each(function (v_path) {
                                              let t_pos = d3
                                                    .select(this)
                                                    .attr('pos')
                                                    .split('_'),
                                                t_lineVisible =
                                                    t_pointVisible(t_pos[0].split(',')) &&
                                                    t_pointVisible(t_pos[1].split(','))
                                              d3
                                                    .select(this)
                                                    .attr('display', t_lineVisible ? 'block' : 'none')
                                            })
                      },
                      t_SubGlyphVisible = () => {
                        let t_glyphVisibleFunc = v_gCls => {
                          let t_baseline = this.clsLevel * t_ctr
                          if (
                                                t_level >= t_baseline - t_div &&
                                                t_level < t_baseline + t_div
                                            ) {
                            let t_originOpc = t_this.pattern
                                                    ? parseFloat(d3.select(v_gCls).attr('ptOpacity'))
                                                    : 1.0
                            return (
                                                    (t_div - Math.abs(t_level - t_baseline)) /
                                                    t_div *
                                                    t_originOpc
                            )
                          } else {
                            return false
                          }
                        }
                        let t_Cls = t_this.d3el.selectAll('.dimFan')
                        t_changeVisible(t_Cls, t_glyphVisibleFunc, true)
                      },
                      t_SubGridVisible = () => {
                        let t_visible = new Set(),
                          invisible = false
                        t_this.d3el
                                            .selectAll('.SubMapGrids')
                                            .classed('visible', false)
                                            .classed('invisible', true)
                                            .interrupt()
                                            .transition()
                                            .duration(v_duration)
                                            .attr('opacity', 0)
                        let t_dictionary = t_clsVisible.dictionary,
                          t_visible_gs = t_this.d3el
                                            .selectAll('.SubMapGrids')
                                            .filter(function (v_grid) {
                                              let t_pos = d3
                                                    .select(this)
                                                    .attr('position')
                                                    .split('_'),
                                                t_isVisible = t_pointVisible(t_pos),
                                                t_id = v_grid.id
                                              if (t_isVisible && t_id != null) {
                                                t_visible.add(t_id)
                                                let t_glbPos = Basic.scale(t_scales, v_grid.pos),
                                                  tt_scale = t_transform.scale,
                                                  tt_trans = t_transform.translate
                                                if (t_transform.scaleFirst) {
                                                  t_glbPos[0] =
                                                            t_glbPos[0] * tt_scale + tt_trans[0]
                                                  t_glbPos[1] =
                                                            t_glbPos[1] * tt_scale + tt_trans[1]
                                                } else {
                                                  t_glbPos[0] =
                                                            (t_glbPos[0] + tt_trans[0]) * tt_scale
                                                  t_glbPos[1] =
                                                            (t_glbPos[1] + tt_trans[1]) * tt_scale
                                                }
                                                t_clsVisible.update(
                                                        v_grid.id,
                                                        t_this.colors[v_grid.id],
                                                        t_glbPos
                                                    )
                                              }
                                              if (!t_isVisible && t_id != null) {
                                                invisible = true
                                              }
                                              return t_isVisible
                                            })
                                            .attr('display', 'block')
                                            .classed('visible', true)
                                            .classed('invisible', false)
                        t_visible_gs
                                            .interrupt()
                                            .transition()
                                            .duration(v_duration)
                                            .attr('opacity', function () {
                                              let t_this = d3.select(this),
                                                t_zgOpc = parseFloat(t_this.attr('zgOpacity')),
                                                t_ftOpc = parseFloat(t_this.attr('ftOpacity')),
                                                t_ptOpc = parseFloat(t_this.attr('ptOpacity'))
                                              t_zgOpc = isNaN(t_zgOpc) ? 1.0 : t_zgOpc
                                              t_ftOpc = isNaN(t_ftOpc) ? 1.0 : t_ftOpc
                                              t_ptOpc = isNaN(t_ptOpc) ? 1.0 : t_ptOpc
                                              return t_zgOpc * t_ftOpc * t_ptOpc
                                            })
                        setTimeout(() => {
                          t_this.d3el
                                                .selectAll('.SubMapGrids.invisible')
                                                .attr('display', 'none')
                        })
                      },
                      t_SubSnapshotVisible = v_init => {
                        let t_clsVisible = t_this.currentCls.visible
                        if (v_init) {
                          if (t_clsVisible == null) {
                            t_clsVisible = t_this.currentCls.visible = new Array()
                            t_clsVisible.dictionary = new Map()
                            let t_paths = t_this.currentCls.paths
                            for (let i = 0; i < t_paths.length; i++) {
                              let t_levelPaths = t_paths[i],
                                t_levelVisible = new Array()
                              t_levelVisible.atLevel = false
                              for (let j = 0; j < t_levelPaths.length; j++) {
                                let t_outlier = t_levelPaths[j].outlier
                                if (!t_outlier) {
                                  let t_ids = t_levelPaths[j].ids
                                  for (let k = 0; k < t_ids.length; k++) {
                                    t_levelVisible.push({
                                      index: [j, k],
                                      clsID: [...t_levelPaths[j].previous, k].join(
                                                                        '_'
                                                                    ),
                                      visible: false,
                                      positions: new Array(),
                                      colors: new Array(),
                                      avgPos: null,
                                      avgCol: Basic.getMeanVector(
                                                                        Basic.subArray(this.colors, t_ids[k], [
                                                                          0,
                                                                          1,
                                                                          2
                                                                        ]),
                                                                        false
                                                                    ),
                                      SShotAngle: 0
                                    })
                                  }
                                }
                              }
                              t_clsVisible.push(t_levelVisible)
                            }
                            t_clsVisible.update = function (v_id, v_col, v_pos) {
                              let t_findFunc = v_d => {
                                return v_d == v_id
                              }
                              for (let i = 0; i < this.length; i++) {
                                if (!this[i].atLevel) {
                                  continue
                                }
                                let t_levelVisible = this[i],
                                  t_found = false,
                                  t_foundPath = new Array(),
                                  t_dictionary = this.dictionary
                                for (let j = 0; j < t_levelVisible.length; j++) {
                                  let t_visibleItem = t_levelVisible[j],
                                    t_index = t_visibleItem.index,
                                    t_ids =
                                                                t_clsPaths[i][t_index[0]].ids[t_index[1]],
                                    t_id = t_ids.findIndex(t_findFunc)
                                  if (t_id >= 0) {
                                    t_visibleItem.visible = true
                                    t_visibleItem.positions.push(v_pos)
                                    t_visibleItem.colors.push(v_col)
                                    t_dictionary.set(v_id, [i, j])
                                    break
                                  }
                                }
                              }
                            }
                            t_clsVisible.updateColors = function (v_colorsMap) {
                              let t_duration = t_this.transition.short
                              t_this.d3el
                                                        .selectAll('.SubMapSShot')
                                                        .filter(function () {
                                                          let t_index = d3.select(this).attr('index'),
                                                            t_return = false
                                                          if (v_colorsMap.has(t_index)) {
                                                            t_return = true
                                                            let t_col = Basic.getMeanVector(
                                                                    v_colorsMap.get(t_index),
                                                                    false
                                                                )
                                                            t_col = BasicView.colToRgb(t_col)
                                                                // d3.select(this)
                                                                // .selectAll(".SubMapSnapshot path")
                                                                // .interrupt()
                                                                // .transition()
                                                                // .duration(400)
                                                                // .attr("fill", t_col);
                                                          }
                                                          return t_return
                                                        })
                            }
                          } else {
                            t_clsVisible.dictionary = new Map()
                            for (let i = 0; i < t_clsVisible.length; i++) {
                              let t_levelVisible = t_clsVisible[i]
                              t_clsVisible[i].atLevel = false
                              for (let j = 0; j < t_levelVisible.length; j++) {
                                let t_levelVisibleItem = t_levelVisible[j]
                                t_levelVisibleItem.visible = false
                                t_levelVisibleItem.avgPos = null
                                t_levelVisibleItem.avgCol = null
                                t_levelVisibleItem.sshotAngle = 0
                              }
                            }
                          }
                        } else {
                          let t_center = this.center,
                            t_angles = new Array(),
                            t_PI = Math.PI,
                            t_angInterval = 180 / t_this.snapshotPar.angInterval
                          for (let i = 0; i < t_clsVisible.length; i++) {
                            let t_levelVisible = t_clsVisible[i]
                            for (let j = 0; j < t_levelVisible.length; j++) {
                              let t_levelVisibleItem = t_levelVisible[j]
                              if (t_levelVisibleItem.positions.length > 0) {
                                let t_avgPos = (t_levelVisibleItem.avgPos = Basic.getMeanVector(
                                                                t_levelVisibleItem.positions,
                                                                false
                                                            )),
                                  t_angle = Basic.getAngle(t_center, t_avgPos)
                                t_angle =
                                                            Math.round(t_angle / t_PI * t_angInterval) *
                                                            t_PI /
                                                            t_angInterval
                                t_levelVisibleItem.positions = new Array()
                                                        // t_angles.push({
                                                        //     index: [i,j].join("_"),
                                                        //     angle: t_angle,
                                                        // });
                                t_levelVisibleItem.SShotAngle = t_angle
                              }
                              if (t_levelVisibleItem.colors.length > 0) {
                                t_levelVisibleItem.avgCol = Basic.getMeanVector(
                                                            t_levelVisibleItem.colors,
                                                            false
                                                        )
                                t_levelVisibleItem.colors = new Array()
                              }
                            }
                                                // t_angles.sort((v_a, v_b) => {return v_a.angle - v_b.angle;});
                                                // let t_div = t_angles.length == 0?0:(Math.PI * 2 / t_angles.length);
                                                // for(let i = 0; i < t_angles.length; i++){
                                                //     let t_index = t_angles[i].index.split("_");
                                                //     t_clsVisible[t_index[0]][t_index[1]].SShotAngle =
                                                // }
                          }
                        }
                        return t_clsVisible
                      },
                      t_clsVisible = t_SubSnapshotVisible(true)
                    t_SubClsVisible()
                    t_SubGlyphVisible()
                    t_SubGridVisible()
                    t_SubSnapshotVisible()
                    t_this.updateClusterInfo(false)
                  }
                  toLevel (v_center, v_level, v_duration) {
                    let t_scale = this.clsToScale(v_level),
                      t_trans = [-v_center[0] * t_scale, -v_center[1] * t_scale],
                      t_newTransform =
                                    'translate(' + t_trans + ')scale(' + t_scale + ')',
                      t_zoomer = this.zoom.zoomer,
                      t_oldTrans = t_zoomer.translate(),
                      t_oldScale = t_zoomer.scale(),
                      t_oldTransform =
                                    'translate(' + t_oldTrans + ')scale(' + t_oldScale + ')',
                      t_tolerance = this.parent.sizeTolr,
                      t_needToChange = true
                    if (
                                    Math.abs(t_trans[0] - t_oldTrans[0]) < t_tolerance &&
                                    Math.abs(t_trans[1] - t_oldTrans[1]) < t_tolerance &&
                                    Math.abs(t_scale - t_oldScale) < Number.EPSILON * 1000
                                ) {
                      t_needToChange = false
                    }
                    if (!t_needToChange) {
                      return 0
                    }
                    this.zoom.zoomer.translate(t_trans).scale(t_scale)
                    this.container
                                    .transition()
                                    .duration(v_duration)
                                    .attrTween('transform', () => {
                                      return d3.interpolate(t_oldTransform, t_newTransform)
                                    })
                    if (t_scale > t_oldScale) {
                      this.update(t_trans, t_scale, v_duration)
                    } else {
                      setTimeout(() => {
                        this.update(t_trans, t_scale, v_duration)
                      }, v_duration)
                    }
                    return v_duration
                  }
                  prepareContainer (v_g) {
                    let t_g = (this.container = v_g
                                    .call(this.zoom.zoomer)
                                    .on('dblclick.zoom', null)
                                    .append('g')
                                    .attr('class', 'SubMapTiling'))
                    return t_g
                  }
                        }
                let t_duration = this.transition.duration
                return new visibleObj(
                            this,
                            v_center,
                            v_ringDiameter,
                            v_glyphSize,
                            v_clsLevel,
                            v_colors
                        )
              },

              showTiling_new: function (df) {
                // Step 1:   get the layout
                let submapLayout = Geometry.layout.submap(this.collection.subTree, this.fMatrix, this.fCodes.codes, Config.get('gridType'), 2)
                submapLayout.getMap()
                df.resolve()
              },

              showTiling: function (v_df) {
                let t_this = this
                let t_renderMap = (v_df, v_g, v_glyphSize, v_colors) => {
                  let t_makeNewMap = v_duration => {
                      SubGlyph.init(
                                        v_glyphSize,
                                        v_glyphSize,
                                        Config.get('mapType'),
                                        Config.get('glyphType'),
                                        v_colors
                                    )
                      let t_g = v_g
                                        .selectAll('.SubMapGridRows')
                                        .data(t_grids)
                                        .enter()
                                        .append('g')
                                        .attr('class', 'SubMapGridRows')
                                        .selectAll('.SubMapGrids')
                                        .data(v_d => {
                                          return v_d
                                        })
                                        .enter()
                                        .append('g')
                                        .attr('class', 'SubMapGrids')
                                        .attr('index', v_grid => {
                                          if (v_grid.id == null) {
                                            return -1
                                          } else {
                                            if (t_indeces == null) {
                                              return v_grid.id
                                            } else {
                                              return t_indeces[v_grid.id]
                                            }
                                          }
                                        })
                                        .attr('gSize', v_glyphSize)
                                        .classed('empty', v_grid => {
                                          return v_grid.id == null
                                        })
                                        .attr('position', v_grid => {
                                          let t_pos = Basic.scale(t_scales, v_grid.pos)
                                          return t_pos.join('_')
                                        })
                                        .attr('transform', v_grid => {
                                          return (
                                                'translate(' + Basic.scale(t_scales, v_grid.pos) + ')'
                                          )
                                        })
                      this.d3el
                                        .selectAll('.SubMapTiling')
                                        .attr('opacity', 0)
                                        .transition()
                                        .duration(v_duration)
                                        .attr('opacity', 1)
                      t_g.call(function (v_gs) {
                        v_gs.forEach(vv_gs => {
                          vv_gs.forEach(vvv_gs => {
                            let tt_grid = d3.select(vvv_gs).data()[0],
                              t_pid = tt_grid.id,
                              t_col,
                              t_code = tt_grid.code
                            if (t_pid != null) {
                              t_col = v_colors[t_pid]
                              t_col = [~~(255 * t_col[0]), ~~(255 * t_col[1]), ~~(255 * t_col[2])]
                              t_col = 'rgb(' + t_col + ')'
                            } else {
                              t_col = '#fff'
                            }
                            let tt_nghIDs,
                              t_sPos = tt_grid.pos,
                              tt_div
                            switch (Config.get('gridType')) {
                              case 'hexagon':
                                tt_div = Math.PI * 2 / 6
                                tt_nghIDs = new Array(6)
                                for (let i = 0; i < 6; i++) {
                                  tt_nghIDs[i] = {
                                    angle: tt_div * i,
                                    diff: null,
                                    dist: null
                                  }
                                }
                                tt_nghIDs.diffScale = t_diffScale
                                break
                            }
                            if (t_pid != null) {
                              tt_grid.gridNeighbors.forEach(v_ngh => {
                                let t_ngh = t_grids[v_ngh[0]][v_ngh[1]],
                                  tt_id = t_ngh.id,
                                  tt_dist,
                                  tt_diff,
                                  t_nPos = t_ngh.pos,
                                  t_divPos = [
                                    t_nPos[0] - t_sPos[0],
                                    t_nPos[1] - t_sPos[1]
                                  ],
                                  t_angle
                                if (tt_id != null) {
                                  tt_dist = t_distMat[t_pid][tt_id]
                                  tt_diff = t_diffMat[t_pid][tt_id]
                                  if (Math.abs(t_divPos[0]) < Number.EPSILON) {
                                    if (t_nPos[1] > t_sPos[1]) {
                                      t_angle = Math.PI / 2
                                    } else {
                                      t_angle = -Math.PI / 2
                                    }
                                  } else {
                                    let t_tan = t_divPos[1] / t_divPos[0]
                                    t_angle = Math.atan(t_tan)
                                    if (t_tan < 0) {
                                      if (t_divPos[1] > 0) {
                                        t_angle += Math.PI
                                      } else {
                                        t_angle += Math.PI * 2
                                      }
                                    } else {
                                      if (t_tan > 0) {
                                        if (t_divPos[1] < 0) {
                                          t_angle += Math.PI
                                        }
                                      } else {
                                        if (t_tan == 0) {
                                          if (t_divPos[0] > 0) {
                                            t_angle = 0
                                          } else {
                                            t_angle = Math.PI
                                          }
                                        }
                                      }
                                    }
                                  }
                                  let t_number = Math.round(t_angle / tt_div)
                                  tt_nghIDs[t_number].dist = t_nghScale(tt_dist)
                                  tt_nghIDs[t_number].diff = tt_diff
                                }
                              })
                            }
                            let t_weights = t_pid == null ? null : t_nghDims[t_pid],
                              t_parameters = [
                                d3.select(vvv_gs),
                                tt_nghIDs,
                                t_pid,
                                t_codes[t_pid],
                                t_col,
                                this.pattern,
                                t_weights,
                                t_nghDimExt
                              ]
                            if (t_pid == null) {
                              t_renderEmpty.add(t_parameters)
                            } else {
                              t_renderGrids.add(t_parameters)
                            }
                          })
                        })
                      })
                      t_renderEmpty.forEach(v_emptyPmt => {
                        let t_g = SubGlyph.showGlyph(...v_emptyPmt)
                      })
                      t_renderGrids.forEach(v_gridPmt => {
                        let t_g = SubGlyph.showGlyph(...v_gridPmt)
                        t_g.on('click', function (v_point) {
                          if (v_point.id == null) {
                            return
                          }
                          t_interactions.pinning(this, false)
                        })
                      })
                    },
                    t_hideOldMap = v_df => {
                      let t_time = this.visible.toLevel([0, 0], 0, t_longDuration),
                        t_df = $.Deferred()
                      setTimeout(() => {
                        t_df.resolve()
                      }, t_time)
                      $.when(t_df).done(() => {
                        let t_midDuration = 0,
                          t_endDuration = 0
                        if (!this.isNew) {
                          t_midDuration = t_longDuration * 0.5
                          t_endDuration = t_longDuration
                          this.hideClusters(true, t_midDuration)
                          setTimeout(() => {
                            this.moveGrids(
                                                    t_grids,
                                                    t_scales,
                                                    v_colors,
                                                    v_glyphSize,
                                                    t_endDuration
                                                )
                          }, 300)
                        }
                        setTimeout(() => {
                          v_df.resolve(t_midDuration)
                        }, t_endDuration * 0.8)
                      })
                    }
                  let t_renderEmpty = new Set(),
                    t_renderGrids = new Set(),
                    t_nghDims = this.nghDims,
                    t_nghDimExt = t_nghDims.extent,
                    t_nghScale = d3.scale
                                .linear()
                                .domain([t_distExt.min, t_distExt.max])
                                .range([0, 0.8]),
                    t_diffScale = d3.scale
                                .linear()
                                .domain([1, t_codeLength])
                                .range([0, v_glyphSize * Math.sqrt(3) * 2 / 3]),
                    t_isTrans = !this.isNew,
                    t_df = $.Deferred()
                  t_hideOldMap(t_df)
                  $.when(t_df).done(v_duration => {
                    t_makeNewMap(v_duration)
                    v_df.resolve()
                  })
                }
                let t_interactions = this.interactions,
                  t_filterCodes = this.fCodes,
                  t_codes = t_filterCodes.codes,
                  t_indeces = t_filterCodes.dataIndeces,
                  t_dimIndeces = t_filterCodes.dimIndeces,
                  t_dataLength = t_codes.length,
                  t_codeLength = t_codes[0].length,
                  t_filterMat = this.fMatrix,
                  t_nghList = t_filterMat.neighbors,
                  t_distMat = t_filterMat.distMat,
                  t_diffMat = t_filterMat.diffMat,
                  t_distExt = t_filterMat.distExt,
                  t_colors = this.currentColors,
                  t_scales = this.scales,
                  t_map,
                  t_grids,
                  t_edges,
                  t_longDuration = this.transition.long,
                  t_shortDuration = this.transition.duration,
                  t_mapChanged = !this.newData || this.zoomed
                        // t_aggrRange = this.aggregate(t_codes, t_nghList);
                        // let t_aggrScale = d3.scale.linear().domain(t_aggrRange).range([0,1]);
                if (!this.zoomed && this.overallMap != null) {
                  t_map = this.overallMap
                } else {
                  t_map = Tiling.getMap(
                                t_nghList,
                                t_distMat,
                                t_codes,
                                Config.get('gridType'),
                                Config.get('gridScaling')
                            )
                            // get the map layout
                  console.log('Map: ', t_map)
                  let submapLayout = Geometry.layout.submap(this.collection.subTree, t_distMat, t_codes, Config.get('gridType'), 2)
                  submapLayout.getMap()
                  console.log('newMap: ', submapLayout)
                  if (!this.zoomed) {
                    this.overallMap = t_map
                  }
                }
                if (typeof t_map === 'string') {
                            // failed
                  throw 'ERROR: ' + t_map
                }
                t_grids = t_map.grids
                t_edges = t_map.edges
                if (!this.freeDim) {
                  this.freeDim = t_codeLength
                }
                let t_centerID = t_grids.getCenterPID(),
                  t_colorScale = d3.scale
                            .linear()
                            .domain([0, 1])
                            .range([45, 315]) // hue channel
                if (this.zoomed) {
                  let t_subColors = Basic.subArray(this.colors, t_indeces, [0, 1, 2])
                  t_colors = SubRotate.groupMoveTo(t_colors, t_subColors) // rgb color;
                } else {
                  if (!this.colorFixed) {
                    this.colors = SubRotate.pointMoveTo(
                                    t_colors,
                                    t_centerID,
                                    Config.get('centerColor')
                                ) // rgb color;
                    this.colorFixed = true
                  }
                  t_colors = this.colors
                }
                this.informOthers('SubMapCollectionView__UpdateMap', {
                  mapChanged: t_mapChanged,
                  colors: t_mapChanged ? t_colors : this.colors,
                  clusters: this.currentCls.clusters,
                  selections: null,
                  codes: t_codes,
                  dimensions: this.collection.dimensions,
                  dimIndeces: t_dimIndeces,
                  dataIndeces: t_indeces
                })
                this.newData = false
                let t_center = [
                    (t_scales.x.range()[1] + t_scales.x.range()[0]) * 0.5,
                    (t_scales.y.range()[1] + t_scales.y.range()[0]) * 0.5
                  ],
                  t_dRing = [
                    t_scales.x.range()[1] - t_scales.x.range()[0],
                    t_scales.y.range()[1] - t_scales.y.range()[0]
                  ],
                  t_rSize = t_dRing[0] * 0.5 / t_grids.radius,
                  t_clsLevel = this.currentCls.level,
                  t_dfResetZoom = $.Deferred(),
                  t_dfHdlOldMap = $.Deferred(),
                  t_g
                if (!this.isNew) {
                  let t_time = this.visible.toLevel([0, 0], 0, t_shortDuration)
                  setTimeout(() => {
                    t_dfResetZoom.resolve()
                  }, t_time)
                } else {
                  t_dfResetZoom.resolve()
                }
                $.when(t_dfResetZoom).done(() => {
                  this.d3el
                                .select('.SubMapTiling')
                                .classed('SubMapTiling', false)
                                .classed('SubOldTiling', true)
                  this.visible = this.initVisible(
                                t_center,
                                t_dRing[0],
                                t_rSize,
                                t_clsLevel,
                                t_colors
                            )
                  t_g = this.visible.prepareContainer(this.d3el)
                  t_renderMap(t_dfHdlOldMap, t_g, t_rSize, t_colors)
                })
                $.when(t_dfHdlOldMap).done(() => {
                  this.showClusters(t_map, t_scales)
                  this.visible.update([0, 0], 1.0)
                  this.clsColorReady = true
                  this.updateClusterInfo()
                  this.isNew = false
                  v_df.resolve()
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

              showClusters: function (v_map, v_scales) {
                let t_getPathTree = (
                                v_cls,
                                v_paths,
                                v_currentLevel,
                                v_prev,
                                v_id
                            ) => {
                  let t_cls = new Array(),
                    t_out = new Array(),
                    t_returnCls = new Array()
                  for (let i = 0; i < v_cls.length; i++) {
                    if (v_cls[i].length != null) {
                      let t_simpleCls,
                        t_prev = v_prev.slice(0)
                      t_prev.push(i)
                      t_simpleCls = t_getPathTree(
                                            v_cls[i],
                                            v_paths,
                                            v_currentLevel + 1,
                                            t_prev,
                                            i
                                        )
                      t_cls.push(t_simpleCls)
                      t_returnCls.push(...t_simpleCls)
                    } else {
                      t_returnCls.push(v_cls[i])
                      t_out.push(v_cls[i])
                    }
                  }
                  if (t_cls.length > 0) {
                    let t_paths = Tiling.getGridClusters(v_map, t_cls)
                    v_paths[v_currentLevel].push({
                      previous: v_prev,
                      selfID: v_id + '',
                      paths: t_paths,
                      ids: t_cls,
                      outlier: false
                    })
                  }
                  if (v_currentLevel < v_paths.length && t_out.length > 0) {
                    t_out = [t_out]
                    let t_outPaths = Tiling.getGridClusters(v_map, t_out)
                    v_paths[v_currentLevel].push({
                      previous: v_prev,
                      selfID: v_id + '',
                      paths: t_outPaths,
                      ids: t_out,
                      outlier: t_cls.length > 0
                    })
                  }
                  return t_returnCls
                },
                  t_renderPaths = (v_clsPaths, v_classNames, v_prev, v_isOut) => {
                    let t_clsLevel = v_prev.length,
                      t_cls = this.d3el
                                    .select('.SubMapTiling')
                                    .selectAll('.' + v_classNames)
                                    .data(v_clsPaths)
                                    .enter()
                                    .append('g')
                                    .attr('class', (v_d, v_i) => {
                                      let t_extra = v_isOut ? ' Outliers' : ''
                                      return (
                                            'SubMapClusters ' + v_classNames + '_' + v_i + t_extra
                                      )
                                    })
                                    .attr('clsID', (v_d, v_i) => {
                                      return [...v_prev, v_i].join('_')
                                    })
                                    .attr('fill-opacity', 0.0)
                                    .on('mouseover', function (v_d, v_i) {
                                      let t_clsID = d3.select(this).attr('clsID')
                                      if (t_interactions.hoveredID != t_clsID) {
                                        t_interactions.hoveredID = t_clsID
                                        t_interactions.mouseOver(this, v_isOut)
                                      }
                                    })
                                    .on('mouseout', (v_d, v_i) => {
                                      t_interactions.hoveredID = null
                                      t_interactions.mouseOut(v_isOut)
                                    })
                                    .on('click', function (v_d, v_i) {
                                      Basic.delay('clickPinning', 400, () => {
                                        t_interactions.pinning(this)
                                      })
                                    })
                                    .on('dblclick', (v_d, v_i) => {
                                      Basic.clearDelay('clickPinning')
                                      if (!v_isOut) {
                                        this.visible.toLevel(
                                                v_d.center,
                                                v_d.clsLevel + 1,
                                                this.transition.long
                                            )
                                      }
                                    })
                    t_cls.call(v_gs => {
                      v_gs[0].forEach(v_g => {
                        let t_clusterPaths = d3.select(v_g).data()[0],
                          t_paths = new Array(),
                          t_lines = new Array(),
                          t_rangePath = new Array(),
                          t_rangePts,
                          t_diameter = 0
                                        // draw block paths
                        for (let i = 0; i < t_clusterPaths.paths.length; i++) {
                          let t_clusterPath = t_clusterPaths.paths[i]
                          try {
                            let t_test = Basic.scale(v_scales, t_clusterPath[0])
                          } catch (err) {
                            console.error(err, t_clusterPaths)
                          }
                          let t_pt = Basic.scale(v_scales, t_clusterPath[0]),
                            t_path = 'M' + t_pt
                          for (let j = 1; j < t_clusterPath.length; j++) {
                            let t_pt_j = Basic.scale(v_scales, t_clusterPath[j])
                            t_path += ' L' + t_pt_j
                            t_rangePath.push(t_pt_j)
                          }
                          t_paths.push(t_path)
                        }
                        for (let i = 0; i < t_rangePath.length - 1; i++) {
                          for (let j = i + 1; j < t_rangePath.length; j++) {
                            let t_dist = Basic.getDistance(
                                                    t_rangePath[i],
                                                    t_rangePath[j]
                                                )
                            if (t_dist > t_diameter) {
                              t_diameter = t_dist
                              t_rangePts = [i, j]
                            }
                          }
                        }
                        for (let i = 0; i < t_rangePts.length; i++) {
                          t_rangePts[i] = t_rangePath[t_rangePts[i]]
                        }
                        t_clusterPaths.center = Basic.getMeanVector(
                                            t_rangePts,
                                            false
                                        )
                        t_clusterPaths.diameter = t_diameter
                        t_clusterPaths.clsLevel = t_clsLevel
                        d3
                                            .select(v_g)
                                            .selectAll('path')
                                            .data(t_paths)
                                            .enter()
                                            .append('path')
                                            .attr('d', vv_path => {
                                              return vv_path
                                            })
                                        // draw edge lines
                        if (!d3.select(v_g).classed('Outliers')) {
                          d3
                                                .select(v_g)
                                                .append('g')
                                                .attr('class', 'SubClsPaths')
                                                .selectAll('.SubClsPath')
                                                .data(t_clusterPaths.lines)
                                                .enter()
                                                .append('g')
                                                .attr('class', 'SubClsPath')
                                                .each(function (v_pathPoints, v_i) {
                                                  let t_start = Basic.scale(v_scales, v_pathPoints[0]),
                                                    t_end = Basic.scale(v_scales, v_pathPoints[1]),
                                                    t_line = [t_start, t_end].join('_')
                                                  d3
                                                        .select(this)
                                                        .attr('pos', t_line)
                                                        .selectAll('line')
                                                        .data(v_pathPoints)
                                                        .enter()
                                                        .append('line')
                                                        .attr('x1', v_line => {
                                                          return t_start[0]
                                                        })
                                                        .attr('y1', v_line => {
                                                          return t_start[1]
                                                        })
                                                        .attr('x2', v_line => {
                                                          return t_end[0]
                                                        })
                                                        .attr('y2', v_line => {
                                                          return t_end[1]
                                                        })
                                                        .attr('stroke', '#666')
                                                })
                        }
                      })
                    })
                  }
                let t_this = this,
                  t_interactions = this.interactions,
                  t_clsPaths = new Array(),
                  t_levels = this.currentCls.level
                if (!this.zoomed && this.overallCls.paths != null) {
                  t_clsPaths = this.currentCls.paths
                } else {
                  let t_cls = this.currentCls.clusters
                  for (let i = 0; i < t_levels; i++) {
                    t_clsPaths.push(new Array())
                  }
                  t_getPathTree(t_cls, t_clsPaths, 0, [], null)
                  this.currentCls.paths = t_clsPaths
                }
                for (let i = t_clsPaths.length; i > 0; i--) {
                  let t_clsLevel = t_clsPaths[i - 1]
                  for (let j = 0; j < t_clsLevel.length; j++) {
                    let t_pathData = t_clsLevel[j],
                      t_paths = t_pathData.paths,
                      t_prev = t_pathData.previous,
                      t_isOut = t_pathData.outlier
                    t_renderPaths(
                                    t_paths,
                                    'SubCls' + t_prev.join('_'),
                                    t_prev,
                                    t_isOut
                                )
                  }
                }
                this.updateClusterInfo()
              },

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
                    this.informOthers(
                                    'SubMapCollectionView__ShowClusters',
                                    t_centers
                                )
                  }
                  t_initClsProjections()
                } else {
                  let t_updateClsProjections = () => {
                    let t_centers = new Array(),
                      t_aggr = this.currentCls.aggregate,
                      t_tree = this.collection.subTree,
                      t_findVisible = v_clsIDs => {
                        let t_visibleList = this.currentCls.visible[
                                                v_clsIDs.length - 1
                                            ],
                          t_clsID = v_clsIDs.join('_'),
                          t_visibleItem = t_visibleList.filter(v_visibleItem => {
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
                      let t_clsID = t_this.attr('clsID').split('_'),
                        t_cid = t_clsID.length - 1,
                        t_info = {
                          clsID: t_this.attr('clsID'),
                          visible: t_findVisible(t_clsID)
                        }
                      if (t_centers[t_cid] == undefined) {
                        t_centers[t_cid] = []
                      }
                      t_centers[t_cid].push(t_info)
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
                    let t_gs = d3.selectAll('.SubMapGrids')
                    this.pattern = !this.pattern
                    SubGlyph.changeGlyph(t_gs, this.pattern, this.nghDims)
                    if (this.pattern) {
                      $('#Pattern #text').text('Hide Pattern')
                    } else {
                      $('#Pattern #text').text('Show Pattern')
                    }
                  }
                })
              },

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
                  message: 'SubMapCollectionView__HideProjection',
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
