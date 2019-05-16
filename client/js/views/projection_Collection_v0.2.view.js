define([
  'require',
  'marionette',
  'underscore',
  'jquery',
  'backbone',
  'datacenter',
  'config',
  'Base',
  'HDPainter',
  'basicFunctions',
  'basicViewOperations',
  'mst',
  'SubMap_ModelView'
], function (require, Mn, _, $, Backbone, Datacenter, Config, Base, Hdpainter, loadBasic, loadBasicView, MST, SubMap_ModelView) {
  'use strict'

  let VersionControl = {
    one: true, // this view shows a single projection
    two: false // this view shows all cluster-based projections
        // two is not usable due to interaction reasons (zoom in / zoom out)
  }

  String.prototype.visualLength = function (d) {
    var ruler = $('#ruler')
    ruler.css('font-size', d + 'px').text(this)
    return [ruler[0].offsetWidth, ruler[0].offsetHeight]
  }

  var Projection_CollectionView = Mn.CollectionView.extend(_.extend({

    tagName: 'g',

    attributes: {
      'id': 'Projection'
    },

    childView: SubMap_ModelView,

    childEvents: {},

    childViewOptions: {
      layout: null
    },

    init: function () {
      var t_width = parseFloat($('#Projection_CollectionViewSVG').css('width')),
        t_height = parseFloat($('#Projection_CollectionViewSVG').css('height')),
        t_size = Math.min(t_width, t_height)
      var t_left = (t_width - t_size) / 2 + t_size * 0.05,
        t_top = (t_height - t_size) / 2 + t_size * 0.05
      var t_defaults = {
        canvasSize: Config.get('drawSize'),
        size: t_size,
        canvasRange: [
                    [t_left, t_left + t_size * 0.9],
                    [t_top, t_top + t_size * 0.9]
        ],
        scale: {
          x: d3.scale.linear().range([t_left, t_left + t_size * 0.9]),
          y: d3.scale.linear().range([t_top, t_top + t_size * 0.9])
        },
        defaultCode: null,
        defaultProjection: null,
        clusterFeatureSubspaces: new Map(),
        clusterFeatureProjections: new Map(),
        clusterDimensionWeights: new Map(),
        defaultReady: null,
        fontSize: 12,
        ready: false,
        hidden: false,
        hover: {
          timer: null,
          time: 1500,
          shown: null
        },
        transition: Config.get('transition'),
        parameter: {
          size: t_size,
          r: 6
        },
        painter: HDPainter.init(this.d3el, {
          canvasRange: [
                        [t_left, t_left + t_size * 0.9],
                        [t_top, t_top + t_size * 0.9]
          ],
          tooltipContainer: '#rightTop',
          interSteps: this.collection.frames
        }),
        filterers: {
          highlight: BasicView.filter({
            container: this.d3el,
            overallSelector: '.ProjectionPoint',
            overallKey: 'index',
            overallFilterFunc: null,
            subSelector: null,
            controlAttr: 'fill',
            static: {
              attrs: ['class'],
              match: ['chosen'],
              miss: [null],
              normal: [false]
            },
            animation: () => {}
          }),
          dataLength: 0,
          IDs: null,
          colorScale: d3.scale.linear().range([0, 1]),
          colorExtent: [
                        [192, 192, 192],
                        [0, 0, 0]
          ],
          colorArray: null
        }
      }
      _.extend(this, t_defaults)
    },

    initialize: function (options) {
      var self = this
      this.init()
      options = options || {}
      _.extend(this, options)
      this.layout = Config.get('childviewLayout')
      this.bindAll()
    },

    onShow: function () {
      let t_width = parseFloat($('#Projection_CollectionViewSVG').css('width')),
        t_height = parseFloat($('#Projection_CollectionViewSVG').css('height')),
        t_scale = this.size / this.canvasSize,
        t_translate = [t_width / 2, t_height / 2]
    },

    bindAll: function () {
      this.listenTo(Datacenter, 'SubMapCollectionView__DimensionFiltering', this.getDefaultProjection) // not used anymore
      this.listenTo(Datacenter, 'SubMapCollectionView__ShowProjection', this.getProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__DefaultProjection', this.restoreProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__ClearProjection', this.clearProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__HideProjection', this.hideProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__InitClusters', this.initClusters)
      this.listenTo(Datacenter, 'SubMapCollectionView__ShowCluster', this.showCluster)
      this.listenTo(Datacenter, 'SubMapCollectionView__Highlighting', this.updateHighlighting)
            // this.listenTo(Datacenter, "SubMapCollectionView__Choose", this.updateHighlighting_v0);
            // this.listenTo(Datacenter, "SubMapCollectionView__Pin", this.updatePinning);
      this.listenTo(this.collection, 'ProjectionCollection__ShowProjection', this.saveProjection)
      this.listenTo(this.collection, 'ProjectionCollection__ClearAll', this.clearAll)
    },

    getDefaultProjection: function (v_filterObj) {
      let t_codeLength = v_filterObj.codeLength,
        t_dimCover = v_filterObj.dimCover,
        t_defaultCode = new Array(t_codeLength).fill(1)
      if (this.defaultCode == null) {
        this.defaultCode = new Array(t_codeLength).fill(1)
      }
      if (t_dimCover != null) {
        for (let i = 0; i < t_codeLength; i++) {
          if (t_dimCover[i] == 0) {
            t_defaultCode[i] = 0
          }
        }
      }
      this.collection.getProjection(t_defaultCode)
    },

    restoreProjection: function () {
      this.hideProjection(false)
      this.collection.getProjection(this.defaultCode)
    },

    getProjection: function (v_code) {
      this.hideProjection(false)
      this.collection.getProjection(v_code)
    },

    clearProjection: function () {
      this.d3el.selectAll('g').remove()
    },

    hideProjection: function (hidden) {
      if (hidden !== this.hidden) {
        this.hidden = hidden
        BasicView.hide('projectionViewHider', this.d3el, 400, hidden)
      }
    },

    updateProjection: function (v_proj) {
      var self = this,
        t_scales = self.parameter.scales,
        t_r = self.parameter.r,
        t_max = Config.get('data').maxVector
      t_scales.x.domain([-t_max * 0.8, t_max * 0.8])
      t_scales.y.domain([-t_max * 0.8, t_max * 0.8])
      self.clearAll()
      self.d3el.selectAll('.ProjectionPoint')
                .data(v_proj)
                .enter()
                .append('g')
                .classed('ProjectionPoint', true)
                .attr('id', function (t_d, t_i) {
                  return 'ProjectionPoint_' + t_i
                })
                .attr('transform', function (t_d) {
                  return 'translate(' + Basic.scale(t_scales, t_d) + ')'
                })
                .append('circle')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', t_r)
    },

    showBackground: function () {
      if (this.d3el.select('.projBackground').empty()) {
        this.d3el
                    .append('g')
                    .attr('class', 'projBackground')
                    .append('rect')
                    .attr('x', -this.canvasSize / 2)
                    .attr('y', -this.canvasSize / 2)
                    .attr('width', this.canvasSize)
                    .attr('height', this.canvasSize)
      }
    },

    getFeatureSubspaces: function (clsFeatSub, clsDimWgt, clsInfo) {
      let weightThresholds = { low: 0.1, high: 0.9 }
      let dimNumber = -1
      let defaultSubCode = 1 // the dimension is set to 1 by default
      for (let i = 0; i < clsInfo.length; i++) {
        let levelInfo = clsInfo[i]
                // for clusters in each level
        for (let j = 0; j < levelInfo.length; j++) {
          let cls = levelInfo[j]
                    // set the dimension number
          if (dimNumber < 0) {
            dimNumber = cls.weights.length
          }
                    // get the average dimension weights
          let dimWeights = numeric.div(cls.weights, cls.count)
          let featureSubCode = new Array(dimNumber)
          featureSubCode.fill(defaultSubCode)
          for (let k = 0; k < dimNumber; k++) {
            if (dimWeights[k] < weightThresholds.low) {
              featureSubCode[k] = 0 // featured low dimension
            }
            if (dimWeights[k] > weightThresholds.high) {
              featureSubCode[k] = 1 // featured high dimension
            }
          }
          let ID = cls.clsID.join('_')
          clsFeatSub.set(ID, featureSubCode)
          clsDimWgt.set(ID, dimWeights)
        }
      }
    },

    initClusters: function (clsInfo) {
      let clsFeatSub = this.clusterFeatureSubspaces // the feature subspace of each cluster
      let clsFeatProj = this.clusterFeatureProjections // the projection of the feature subspace
      let clsDimWgt = this.clusterDimensionWeights // the average dimension weights
      if (clsFeatProj.size === 0) {
        this.getFeatureSubspaces(clsFeatSub, clsDimWgt, clsInfo)
        let defer = $.Deferred()
        this.collection.getClusterSubspaceProjection(clsFeatSub, clsFeatProj, defer)
      }
    }, // end of initClusters

    showCluster: function (clsID) {
      if (clsID !== undefined && clsID.length !== 0) {
        let clsFeatSub = this.clusterFeatureSubspaces.get(clsID.join('_'))
        this.getProjection(clsFeatSub)
      } else {
        this.restoreProjection()
      }
    }, // end of showCluster

    saveProjection: function (v_cords, v_projections, v_interpolate) {
      this.defaultProjection = v_projections
      if (this.defaultReady != null) {
        this.defaultReady.resolve()
      }
      this.showProjection_v2(v_cords, v_projections, v_interpolate)
    },

    showProjection: function (v_g, v_radius, v_proj, v_weights) {
      let t_scale = d3.scale.linear().domain([-0.32, 0.32]).range([-v_radius, v_radius])
      let t_weights = numeric.sub(1, v_weights)
      let t_colScale = d3.scale.linear().domain([Math.min(...t_weights), Math.max(...t_weights)]).range([0.1, 1])
      let t_colScaleNew = (d) => {
        let t = d * 20 - 10
        return 1 / (Math.exp(-t) + 1)
      }
      let pointSizeRatio = 0.04
      v_g.append('g')
                .attr('class', 'Projection')
                .selectAll('.ProjectionPoint')
                .data(v_proj)
                .enter()
                .append('circle')
                .attr('cx', (v_d) => {
                  return t_scale(v_d[0])
                })
                .attr('cy', (v_d) => {
                  return t_scale(v_d[1])
                })
                .attr('r', v_radius * pointSizeRatio)
                .attr('fill', '#000')
                .attr('opacity', function (v_d, v_i) {
                  let t_opc = t_colScaleNew(0.9 - t_colScale(t_weights[v_i])) * 0.95 + 0.05
                  return t_opc
                })
                .attr('class', 'ProjectionPoint')
    },

    showProjection_v2: function (v_cords, v_projections, v_interpolate) {
      this.painter.setCanvas(this.d3el)
      this.painter.stopAll()
      this.painter.setData(Config.get('data').data, Config.get('data').dimensions.values())
      this.painter.drawBiplot(v_projections, v_cords, v_interpolate)
    },

        // showProjection_v1: function(){
        //     let t_projection = this.collection.projection,
        //         t_g = this.d3el.selectAll(".ProjectionPoint"),
        //         t_dataObj = Config.get("data"),
        //         t_data = t_dataObj.data,
        //         t_r = this.parameter.r,
        //         t_this = this;
        //     if(t_g.empty()){
        //         t_g = this.d3el.selectAll(".ProjectionPoint")
        //         .data(t_projection)
        //         .enter()
        //         .append("g")
        //         .attr("class","ProjectionPoint")
        //         .attr("transform", (t_d, t_i) => {
        //             return "translate(" + Basic.scale(this.scale, t_d) + ")";
        //         })
        //         .attr("id",function(t_d, t_i){
        //             return "ProjectionPoint_"+t_i;
        //         })
        //         .attr("data-html", true)
        //         .attr("data-original-title", function(t_d, t_i){
        //             var t_text = "";
        //             t_dataObj.dimensions.forEach(function(t_key, t_value){
        //                 t_text += t_value+": "+t_data[t_i][t_value]+"</br>";
        //             });
        //             return t_text;
        //         })
        //         .attr("data-placement", "bottom");
        //         $(t_g[0])
        //         .tooltip({
        //             container: "#rightTop",
        //             trigger: "manual",
        //         });
        //         t_g.on("mouseover", function(){
        //             clearTimeout(t_this.hover.timer);
        //             t_this.hover.timer = setTimeout(function(){
        //                 $(this).tooltip("show");
        //             }, t_this.hover.delay);
        //         })
        //         .on("mouseout", function(){
        //             clearTimeout(t_this.hover.timer);
        //             t_this.hover.timer = null;
        //             $(this).tooltip("hide");
        //         });
        //         t_g.append("circle")
        //         .attr("cx",0)
        //         .attr("cy",0)
        //         .attr("r", t_r);
        //     }else{
        //         t_g
        //         .transition()
        //         .ease("linear")
        //         .attr("transform", (t_d, t_i) => {
        //             return "translate(" + Basic.scale(this.scale, t_projection[t_i]) + ")";
        //         });
        //     }
        // },

        // showProjection_v0: function(v_start, v_cord){
        //     var tt_data = Config.get("data"), self = this, t_scale = this.scale, t_shorter = 0.9, t_longer  = 0.95, t_dimensions = tt_data.dimensions.values();
        //     var t_dark = Config.get("lightColor").dark, t_max = Config.get("data").maxVector * 0.8, t_range = [-t_max, t_max];
        //     var tt_proj = self.collection.projection;
        //     if(!this.ready){
        //         var t_proj = [], t_data = tt_data.data;
        //         this.scale.x.domain(t_range);
        //         this.scale.y.domain(t_range);
        //         t_scale = this.scale;
        //         var t_pts = this.d3el.append("g")
        //         .classed("ProjectionPoints", true);
        //         var t_g = t_pts.selectAll(".ProjectionPoint")
        //         .data(tt_proj)
        //         .enter()
        //         .append("g")
        //         .attr("class","ProjectionPoint")
        //         .attr("index", function(t_d, t_i){
        //             return t_i;
        //         })
        //         .attr("id",function(t_d, t_i){
        //             return "ProjectionPoint_"+t_i;
        //         })
        //         .attr("transform",function(t_d, t_i){
        //             var t_pos = Basic.scale(t_scale, t_d);
        //             t_proj[t_i] = t_pos;
        //             return "translate(" + t_pos + ")";
        //         })
        //         .attr("data-html", true)
        //         .attr("data-original-title", function(t_d, t_i){
        //             var t_text = "";
        //             tt_data.dimensions.forEach(function(t_key, t_value){
        //                 t_text += t_value+": "+t_data[t_i][t_value]+"</br>";
        //             });
        //             return t_text;
        //         })
        //         .attr("data-placement", "bottom")
        //         .on("mouseover", function(){
        //             var t_self = this;
        //             clearTimeout(self.hover.timer);
        //             self.hover.timer = setTimeout(function(){
        //                 $(t_self).tooltip("show");
        //             }, self.hover.delay);
        //         })
        //         .on("mouseout", function(){
        //             clearTimeout(self.hover.timer);
        //             self.hover.timer = null;
        //             $(this).tooltip("hide");
        //         });
        //         $(t_g[0])
        //         .tooltip({
        //             container: "#rightTop",
        //             trigger: "manual",
        //         });
        //         t_g.append("circle")
        //         .attr("cx",0)
        //         .attr("cy",0)
        //         .attr("color", function(t_d, t_i){
        //             return t_dark;
        //         })
        //         .attr("r",function(t_d, t_i){
        //             return self.parameter.r;
        //         })
        //         .attr("fill", function(t_d, t_i){
        //             return $(this).attr("color");
        //         });
        //         self.projection = t_proj;
        //         //draw axes
        //         var t_axes = this.d3el.append("g")
        //         .classed("ProjectionAxes", true);
        //         var t_cords = self.collection.coordinates;
        //         var t_axis = t_axes.selectAll(".ProjectionAxis")
        //         .data(t_cords)
        //         .enter()
        //         .append("g")
        //         .attr("class", "ProjectionAxis")
        //         .attr("id", function(t_d, t_i){
        //             return "ProjectionAxis_" + t_i;
        //         })
        //         t_axis.append("line")
        //         .attr("x1", t_scale.x(0))
        //         .attr("y1", t_scale.y(0))
        //         .attr("x2", function(t_d){ return t_scale.x(t_d[0] * t_max * t_shorter);})
        //         .attr("y2", function(t_d){ return t_scale.y(t_d[1] * t_max * t_shorter);});
        //         t_axis.append("text")
        //         .attr("tlength", function(t_d, t_i){
        //             var t_text = t_dimensions[t_i];
        //             var t_size = t_text.visualLength(self.fontSize);
        //             return t_size.join(",");
        //         })
        //         .attr("x", function(t_d){
        //             var t_size = $(this).attr("tlength").split(",");
        //             return t_scale.x(t_d[0] * t_max * t_longer) - t_size[0] / 2;
        //         })
        //         .attr("y", function(t_d){
        //             var t_size = $(this).attr("tlength").split(",");
        //             return t_scale.y(t_d[1] * t_max * t_longer) + t_size[1] / 2;
        //         })
        //         .text(function(t_d, t_i){
        //             return t_dimensions[t_i];
        //         });
        //         this.ready = true;
        //     }else{
        //         var t_max = t_scale.x.domain();
        //         t_max = t_max[1];
        //         var t_frame = self.collection.frames, t_last = (self.collection.nowFrame == t_frame - 1), t_proj = [];
        //         var t_axes = this.d3el.selectAll(".ProjectionAxis")
        //         .data(self.collection.coordinates);
        //         t_axes.select("line")
        //         .transition()
        //         .ease("linear")
        //         .duration(self.transition.interval)
        //         .attr("x2", function(t_d){ return t_scale.x(t_d[0] * t_max * t_shorter);})
        //         .attr("y2", function(t_d){ return t_scale.y(t_d[1] * t_max * t_shorter);});
        //         t_axes.select("text")
        //         .attr("x", function(t_d){
        //             var t_size = $(this).attr("tlength").split(",");
        //             return t_scale.x(t_d[0] * t_max * t_longer) - t_size[0] / 2;
        //         })
        //         .attr("y", function(t_d){
        //             var t_size = $(this).attr("tlength").split(",");
        //             return t_scale.y(t_d[1] * t_max * t_longer) + t_size[1] / 2;
        //         });
        //         var t_projection = this.collection.projection;
        //         this.d3el.selectAll(".ProjectionPoint")
        //         .data(this.collection.projection)
        //         .transition()
        //         .ease("linear")
        //         .duration(self.transition.interval)
        //         .attr("transform",function(t_d){
        //             var t_i = parseInt($(this).attr("index"));
        //             var t_pos = Basic.scale(t_scale, t_projection[t_i]);
        //             if(t_last){
        //                 t_proj[t_i] = t_pos;
        //             }
        //             return "translate("+t_pos+")";
        //         });
        //         this.projection = t_proj;
        //         if(v_start){
        //             this.d3el.selectAll(".ProjectionPoints circle")
        //             .attr("color", function(t_d){
        //                 return t_dark;
        //             })
        //             .transition()
        //             .duration(self.transition.duration)
        //             .ease("linear")
        //             .attr("r", function(){
        //                 return self.parameter.r;
        //             });
        //             var tt_cords = self.collection.basis2;
        //             this.d3el.selectAll(".ProjectionAxis text")
        //             .transition()
        //             .ease("linear")
        //             .duration(self.transition.duration)
        //             .style("opacity", function(t_d, t_i){
        //                 var t_d = tt_cords[t_i], t = t_d[0]*t_d[0] + t_d[1]*t_d[1];
        //                 if(t < 0.1){
        //                     return 0;
        //                 }else{
        //                     return 1;
        //                 }
        //             });
        //         }
        //     }
        // },

    initializeFilter: function (v_filterer) {
      let t_animateFunc = (v_d3selection, v_fit) => {
        let t_cols = this.filterers.colorArray,
          t_colExt = this.filterers.colorExtent
        if (v_fit && t_cols != null) {
          v_d3selection
                        .filter(function () {
                          return !d3.select(this).classed('pinned')
                        })
                        .selectAll('circle')
                        .interrupt()
                        .transition()
                        .attr('fill', function () {
                          let t_index = d3.select($(this).parent()[0]).attr('index')
                          return 'rgb(' + t_cols[t_index] + ')'
                        })
        } else {
          v_d3selection
                        .filter(function () {
                          return !d3.select(this).classed('pinned')
                        })
                        .selectAll('circle')
                        .interrupt()
                        .transition()
                        .attr('fill', function () {
                          return 'rgb(' + t_colExt[0] + ')'
                        })
        }
      }
      v_filterer.animation = t_animateFunc
      v_filterer.init()
    },

    updateHighlighting: function (v_clsID) {
      if (v_clsID == null) {
        this.d3el.selectAll('.ClsProjection')
                    .interrupt()
                    .transition()
                    .duration(400)
                    .attr('opacity', 1)
      } else {
        this.d3el.selectAll('.ClsProjection')
                    .interrupt()
                    .transition()
                    .duration(400)
                    .attr('opacity', 0.5)
        this.d3el.select('#ClsProjection_' + v_clsID.join('_'))
                    .interrupt()
                    .transition()
                    .duration(400)
                    .attr('opacity', 1)
      }
    },

    updateHighlighting_v0: function (v_options) {
      let t_filterers = this.filterers,
        t_filterer = t_filterers.highlight,
        t_attr = v_options.attr,
        t_highlightIDs = t_filterers.IDs,
        t_weights = v_options.weights,
        t_result
      if (!t_filterer.ready) {
        this.initializeFilter(t_filterer)
      }
      if (t_highlightIDs == null) {
        let t_length = t_filterer.dataLength = Config.get('data').data.length
        t_highlightIDs = new Array(t_length)
        for (let i = 0; i < t_length; i++) {
          t_highlightIDs[i] = i + ''
        }
        t_filterers.IDs = t_highlightIDs
      }
      if (t_weights == null) {
        t_result = t_filterer.restore('projection_highlighting', false)
      } else {
        let t_colScale = t_filterers.colorScale,
          t_colArray = t_filterers.colorArray,
          t_colExt = t_filterers.colorExtent
        t_colScale.domain(d3.extent(t_weights))
        if (t_colArray == null) {
          t_colArray = Basic.initArray(t_weights.length, 3)
          t_filterers.colorArray = t_colArray
        }
        for (let i = 0; i < t_weights.length; i++) {
          let t_ratio = t_colScale(t_weights[i])
          t_colArray[i][0] = ~~((t_colExt[1][0] - t_colExt[0][0]) * t_ratio + t_colExt[0][0])
          t_colArray[i][1] = ~~((t_colExt[1][1] - t_colExt[0][1]) * t_ratio + t_colExt[0][1])
          t_colArray[i][2] = ~~((t_colExt[1][2] - t_colExt[0][2]) * t_ratio + t_colExt[0][2])
        }
        if (v_options.IDs.length > 0) {
          t_result = t_filterer.filter('projection_highlighting', t_attr, t_highlightIDs)
        } else {
          t_result = t_filterer.restore('projection_highlighting', false)
        }
      }
    },

    updatePinning: function (v_options) {
      let t_filterers = this.filterers,
        t_filterer = t_filterers.highlight,
        t_attr = v_options.attr,
        t_pinIDs = t_filterers.IDs,
        t_d3el = this.d3el,
        t_result
      if (v_options.IDs != null && v_options.IDs.length > 0) {
        t_d3el.selectAll('.ProjectionPoint')
                    .classed('pinned', false)
        t_result = t_filterer.pick('projection_pinning', t_attr, t_pinIDs)
        t_d3el.selectAll('.ProjectionPoint')
                    .classed('pinned', true)
      } else {
        t_d3el.selectAll('.ProjectionPoint')
                    .classed('pinned', false)
        t_result = t_filterer.restore('projection_pinning', false)
      }
    },

    clearAll: function () {
      this.painter.clearAll()
      this.init()
    }
  }, Base))

  return Projection_CollectionView
})
