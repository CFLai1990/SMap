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
        subspaceProjections: new Map(),
        defaultReady: null,
        fontSize: 12,
        ready: false,
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
        })
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
      d3.select('#Projection_CollectionView')
                .attr('transform', 'translate(' + t_translate + ')scale(' + t_scale + ')')
    },

    bindAll: function () {
/*      this.listenTo(Datacenter, 'SubMapCollectionView__DimensionFiltering', this.getDefaultProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__ShowProjection', this.getProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__DefaultProjection', this.restoreProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__HideProjection', this.hideProjection)
      this.listenTo(Datacenter, 'SubMapCollectionView__ShowClusters', this.showClusters)
      this.listenTo(Datacenter, 'SubMapCollectionView__UpdateClusters', this.updateClusters)
      this.listenTo(Datacenter, 'SubMapCollectionView__Highlighting', this.updateHighlighting)
      this.listenTo(this.collection, 'ProjectionCollection__ShowProjection', this.saveProjection) */
      this.listenTo(this.collection, 'ProjectionCollection__ClearAll', this.clearAll)
    },

    clearAll: function () {
      this.painter.clearAll()
      this.init()
    }
  }, Base))

  return Projection_CollectionView
})
