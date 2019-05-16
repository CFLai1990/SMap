define([
  'require',
  'marionette',
  'underscore',
  'jquery',
  'config',
  'backbone',
  'Projection_Model'
], function (require, Mn, _, $, Config, Backbone, Projection_Model) {
  'use strict'

  var dot = numeric.dot,
    trans = numeric.transpose,
    sub = numeric.sub,
    div = numeric.div,
    clone = numeric.clone,
    getBlock = numeric.getBlock,
    add = numeric.add,
    mul = numeric.mul,
    svd = numeric.svd,
    norm2 = numeric.norm2,
    identity = numeric.identity,
    dim = numeric.dim,
    getDiag = numeric.getDiag,
    inv = numeric.inv
  var abs = Math.abs,
    sqrt = Math.sqrt,
    pow = Math.pow

  $.whenWithProgress = function (arrayOfPromises) {
    var cntr = 0
    for (var i = 0; i < arrayOfPromises.length; i++) {
      arrayOfPromises[i].done()
    }
    return jQuery.when.apply(jQuery, arrayOfPromises)
  }

  var Projection_Collection = Backbone.Collection.extend({
    model: Projection_Model,

    initialize: function () {
      var t_defaults = {
        count: 0,
        data: null,
        projection: null,
        coordinates: null,
        basis1: null,
        basis2: null,
        frames: 10,
        nowFrame: null,
        timer: null,
        transCoordinates: null,
        interval: Config.get('transition').interval,
        precision: 7
      }
      _.extend(this, t_defaults)
    },

    getClusterSubspaceProjection: function (clusterToSubspaceMap, clusterToProjectionMap, defer) {
      let deferGroup = []
      for (let clsToSub of clusterToSubspaceMap) {
        let clsID = clsToSub[0]
        let subcode = clsToSub[1]
        let clsDefer = $.Deferred()
        let timerID = deferGroup.length
        deferGroup.push(clsDefer)
        // set the parameters
        let parameters = {}
        parameters[`featureCode_${timerID}`] = subcode
        parameters['featureCordExpand'] = true
        this.trigger('ProjectionCollection__Panda', parameters,
          `Coord(Subspace(normData, featureCode_${timerID}), featureCordExpand)`, (cords) => {  // get coordinates
            let finalCords = this.fixSubCoords(cords, subcode)
            clusterToProjectionMap.set(clsID, finalCords)
            clsDefer.resolve()
          }, true, true)
      }
      $.whenWithProgress(deferGroup)
                .done(() => {
                  defer.resolve()
                })
    },

    getProjection: function (v_subspace) {
      if (true) {
        let t_df0 = $.Deferred(),
          t_df1 = $.Deferred()
        this.basis1 = this.basis2
        this.trigger('ProjectionCollection__Panda', { // get coordinates
          subCode: v_subspace,
          cordExpand: true
        }, 'Coord(Subspace(normData, subCode), cordExpand)', (v_cords) => {
          t_df0.resolve(this.fixSubCoords(v_cords, v_subspace))
        }, true, true)
        $.when(t_df0).done((v_cords) => { // get transformation
          if (this.basis1 != null) {
            this.trigger('ProjectionCollection__Panda', {
              subCords_Old: this.basis1,
              subCords: v_cords,
              subFrames: this.frames
            }, 'CoordsTransform(subCords_Old, subCords, subFrames)', (v_cords_arr) => {
              if (v_cords_arr.length == 1) {
                this.basis2 = clone(this.basis1)
                t_df1.resolve(false)
              } else {
                let t_cords = Basic.arrToCube(v_cords_arr, this.basis1.length, this.basis1[0].length, false)
                this.basis2 = t_cords[t_cords.length - 1]
                this.transCoordinates = t_cords
                t_df1.resolve(true)
              }
            }, true, true)
          } else {
            this.basis2 = v_cords
            t_df1.resolve(false)
          }
        })
        $.when(t_df1).done((v_move) => { // animation
          let t_data = Config.get('data').array
          if (!v_move) {
            if (this.basis1 == null) {
              this.trigger('ProjectionCollection__ShowProjection', this.basis2, dot(t_data, this.basis2), false)
            }
          } else {
            let t_projections = new Array(this.frames)
            for (let i = 0; i < this.frames; i++) {
              t_projections[i] = dot(t_data, this.transCoordinates[i])
            }
            this.trigger('ProjectionCollection__ShowProjection', this.transCoordinates, t_projections, true)
          }
        })
      } else {
        var self = this,
          t_data = trans(Config.get('data').array),
          t_array = []
        if (!self.data) {
          self.data = Config.get('data').array
        }
        for (var i in v_subspace) {
          if (v_subspace[i]) {
            t_array.push(t_data[i])
          }
        }
        t_array = trans(t_array)
        var t_cords = MDS.getCoordinates(t_array, true)
        t_cords = self.fixSubCoords(t_cords, v_subspace)
        self.updateCoordinates(self.data, t_cords)
      }
    },

    fixSubCoords: function (v_cords, v_sub) {
      var t_cords = [],
        t_count = 0
      for (var i in v_sub) {
        if (v_sub[i] > 0) {
          t_cords[i] = v_cords[t_count]
          t_count++
        } else {
          t_cords[i] = [0, 0]
        }
      }
      return t_cords
    },

    update: function () {
      var self = this
      self.clearAll()
    },

    clearAll: function () {
      this.reset()
      var t_defaults = {
        count: 0,
        data: null,
        projection: null,
        coordinates: null,
        basis1: null,
        basis2: null,
        frames: 10,
        nowFrame: null,
        timer: null,
        transCoordinates: null,
        interval: Config.get('transition').interval
      }
      _.extend(this, t_defaults)
      this.trigger('ProjectionCollection__ClearAll')
    }
  })
  return Projection_Collection
})
