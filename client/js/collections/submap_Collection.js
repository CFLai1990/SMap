define([
  'require',
  'marionette',
  'underscore',
  'jquery',
  'backbone',
  'combinations',
  'SubMap_Model'
], function (require, Mn, _, $, Backbone, Combinations, SubMap_Model) {
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
    inv = numeric.inv,
    sum = numeric.sum

  $.whenWithProgress = function (arrayOfPromises) {
    var cntr = 0
    for (var i = 0; i < arrayOfPromises.length; i++) {
      arrayOfPromises[i].done()
    }
    return jQuery.when.apply(jQuery, arrayOfPromises)
  }

  var SubMap_Collection = Backbone.Collection.extend({
    model: SubMap_Model,

    initialize: function () {
      let t_defaults = {
        clusters: null,
        clusterLevel: null,
        dimensions: null,
        dimCount: null,
        dimRange: null,
        dimCoverage: null,
        dataIndeces: null,
        subIndex: null,
        subNghList: null,
        subTree: null,
        sampleCount: null,
        dataSize: null,
        dataDist: null,
        projDist: null,
        dimDist: null,
        projection: null,
        colors: null,
        timer: null,
        tpModel: {
          wordmap: null,
          DTMatrix: null,
          TWMatrix: null,
          TDims: null
        },
        viewObject: null,
        realTime: Config.get('realTimeCompute'),
        dataID: null,
        dataFiles: new Map(),
        getLevelFunc: null,
        stages: {
          'Sampling': ['Sampling subspaces', 0.1],
          'Sampling_load': ['Sampling subspaces', 0.1],
          'KNNGraphs': ['Building data neighborhoods', 0.2],
          'KNNGraphs_load': ['Building data neighborhoods', 0.2],
          'Distances': ['Getting subspace distances', 0.3],
          'Distances_load': ['Getting subspace distances', 0.3],
          'SubNeighbors': ['Building subspace neighborhoods', 0.6],
          'SubNeighbors_load': ['Building subspace neighborhoods', 0.6],
          'SubHierClusters': ['Getting subspace clusters', 0.7],
          'SubHierClusters_load': ['Getting subspace clusters', 0.7],
          'SubTree': ['Collecting subspace information', 0.8],
          'SubTree_load': ['Collecting subspace information', 0.8],
          'Rendering': ['Rendering the results', 0.9],
          'Rendering_load': ['Rendering the results', 0.9]
        }
      }
      _.extend(this, t_defaults)
      this.initFunctions()
    },

    initFunctions: function () {
      let t_getLevel = (v_clsIDs, v_indeces, v_level, v_maxLevel, v_maxObj) => {
        let t_cls = new Map(),
          t_out = new Array(),
          t_max = -1
        if (v_level > v_maxObj.level) {
          v_maxObj.level = v_level
        }
        for (let i = 0; i < v_clsIDs.length; i++) {
          let t_id = v_clsIDs[i][v_level],
            t_ind = v_indeces[i]
          if (t_id > t_max) {
            t_max = t_id
          }
          if (t_id < 0) {
            t_out.push(i)
          } else {
            if (t_cls.get(t_id) == null) {
              t_cls.set(t_id, [i])
            } else {
              t_cls.get(t_id).push(i)
            }
          }
        }
        let t_clsArray = new Array(t_max + 1)
        for (let i = 0; i < t_max + 1; i++) {
          t_clsArray[i] = t_cls.get(i)
        }
        let t_all = [...t_clsArray, ...t_out],
          t_return = new Array()
        if (t_out.length == 0 && t_clsArray.length == 1) {
          t_all = t_all[0]
        }
        for (let i = 0; i < t_all.length; i++) {
          if (t_all[i].length == null) {
            t_return.push(v_indeces[t_all[i]])
          } else {
            if (v_level <= v_maxLevel) {
              let t_clsIDs = new Array(),
                t_indeces = new Array()
              for (let j = 0; j < t_all[i].length; j++) {
                let t_i = t_all[i][j]
                t_clsIDs.push(v_clsIDs[t_i])
                t_indeces.push(v_indeces[t_i])
              }
              t_return.push(t_getLevel(t_clsIDs, t_indeces, v_level + 1, v_maxLevel, v_maxObj))
            } else {
              let t_nextLevel = new Array()
              for (let j = 0; j < t_all[i].length; j++) {
                let t_i = t_all[i][j]
                t_nextLevel.push(v_indeces[t_i])
              }
              t_return.push(t_nextLevel)
            }
          }
        }
        return t_return
      }
      this.getLevelFunc = t_getLevel
    },

    updateFileNames: function (v_dataID) {
      let t_dataFiles = this.dataFiles,
        t_variables = ['subCodes', 'subGraphs', 'subKNNDistr', 'subDataDist', 'subColors', 'subClusters', 'subSortList', 'subNghList', 'mapInitProjection']
      for (let i = 0; i < t_variables.length; i++) {
        t_dataFiles.set(t_variables[i], v_dataID + '_' + t_variables[i])
      }
    },

    update: function (v_options) {
      this.clearAll()
      _.extend(this, v_options)
      let t_dataID = this.dataID = Config.get('currentData'),
        t_realTime = this.realTime
      this.updateFileNames(t_dataID)
      let t_df1 = $.Deferred(),
        t_df2 = $.Deferred(),
        t_df3 = $.Deferred(),
        t_df4 = $.Deferred(),
        t_df5 = $.Deferred(),
        t_df6 = $.Deferred(),
        t_df7 = $.Deferred(),
        t_df8 = $.Deferred()
      let test = false
            // t_df6 = $.Deferred();
      if (t_realTime) {
        this.sampling(t_df1)
        $.when(t_df1).done(n => {
          this.getKNNGraphs(t_df2)
        })
        $.when(t_df2).done(n => {
          this.getDistances(t_df3)
        })
        $.when(t_df3).done(n => {
          this.getSubNeighbors(t_df4)
        })
        $.when(t_df4).done(n => {
          this.getColors(t_df5)
                    // this.getSubspaceClusters(t_df5);
        })
        $.when(t_df5).done(n => {
          this.getSubHierClusters(t_df6)
                    // this.getSubspaceClusters(t_df5);
        })
        $.when(t_df6).done(n => {
          this.getSubTree(t_df7)
        })
        $.when(t_df7).done(n => {
          this.getMapInitProjection(t_df8)
        })
        $.when(t_df8).done(n => {
          if (test) {
            this.test()
          }
          this.setStage('Rendering')
          this.trigger('SubMapCollection__ShowMap')
        })
      } else {
        this.sampling_load(t_df1)
        $.when(t_df1).done(n => {
          this.getKNNGraphs_load(t_df2)
        })
        $.when(t_df2).done(n => {
          this.getDistances_load(t_df3)
        })
        $.when(t_df3).done(n => {
          this.getSubNeighbors_load(t_df4)
        })
        $.when(t_df4).done(n => {
          this.getColors_load(t_df5)
                    // this.getSubspaceClusters(t_df5);
        })
        $.when(t_df5).done(n => {
          this.getSubHierClusters_load(t_df6)
                    // this.getSubspaceClusters(t_df5);
        })
        $.when(t_df6).done(n => {
          this.getSubTree_load(t_df7)
                    // this.getSubTree_load(t_df7);
        })
        $.when(t_df7).done(n => {
          this.getMapInitProjection_load(t_df8)
        })
        $.when(t_df8).done(n => {
          if (test) {
            this.test()
          }
          this.setStage('Rendering_load')
          this.trigger('SubMapCollection__ShowMap')
        })
      }
            // $.whenWithProgress(t_dfs1)
            // .done(() => {
            //     this.trigger("SubMapCollection__ShowMap");
            // });
            // $.when(t_df4).done(n => {
            //     this.trainModel(t_df5);
            // });
            // $.when(t_df5).done(n => {
            //     this.getModel(t_df6);
            // });
            // $.when(t_df6).done(n => {
            //     this.drawModel();
            // });
    },

    setStage: function (v_state) {
      let t_stage = this.stages[v_state]
      this.trigger('SubMapCollection__UpdateProgress', t_stage)
    },

    sampling: function (v_df) {
      this.setStage('Sampling')
      var t_dimC = this.dimCount = this.dimensions.length,
        t_top = Math.pow(2, t_dimC) - 1,
        t_all,
        t_count = 0
      var log = Math.log,
        round = Math.round,
        min = Math.min,
        max = Math.max
      var self = this,
        t_dimRange = [max(self.dimRange[0], 2), min(self.dimRange[1], self.dimCount)],
        t_sum = 0
      self.timer = new Date().getTime()
      for (var i = t_dimRange[0]; i <= t_dimRange[1]; i++) {
        let t_comb = Combinations(t_dimC, i)
        t_sum += t_comb
      }
      t_all = min(self.sampleCount, t_sum)
      self.trigger('SubMapCollection__Panda', {
        subDims: t_dimC,
        subRange: t_dimRange,
        subNumber: t_all,
        fileName: this.dataFiles.get('subCodes')
      }, 'PMSave(subCodes = Subsampling(subRange, subDims, subNumber), fileName)', function (v_codes) {
        for (let i = 0; i < v_codes.length; i++) {
          let t_code = v_codes[i].join('')
          self.add(new SubMap_Model({ code: t_code, dimensions: self.dimensions, id: i, collection: self }))
        }
        self.subIndex = v_codes
        self.dataSize = self.sampleCount = v_codes.length
        let t_indeces = self.dataIndeces = new Array()
        for (let i = 0; i < self.sampleCount; i++) {
          t_indeces.push(i)
        }
        console.info('SubMapCollection: Sampling rate: ' + (v_codes.length / t_sum * 100).toFixed(2) + '%')
        v_df.resolve()
      }, true, true)
            // while(t_count < t_all){
            //     var t_st = self.binaryRandom([0, t_top], t_dimRange);
            //     if(!t_indeces.has(t_st)){
            //         t_indeces.add(t_st);
            //         self.add(new SubMap_Model({code: t_st, dimensions: self.dimensions, id: t_count, collection: self}));
            //         t_count ++;
            //     }
            // }
            // self.subIndex = t_indeces;
            // self.sampleCount = t_count;
    },

    sampling_load: function (v_df) {
      this.setStage('Sampling_load')
      let t_dimC = this.dimCount = this.dimensions.length,
        t_dimRange = [Math.max(this.dimRange[0], 2), Math.min(this.dimRange[1], this.dimCount)],
        t_sum = 0
      this.timer = new Date().getTime()
      for (let i = t_dimRange[0]; i <= t_dimRange[1]; i++) {
        let t_comb = Combinations(t_dimC, i)
        t_sum += t_comb
      }
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subCodes')
      }, 'subCodes = PMLoad(fileName)', (v_codes) => {
        if (v_codes == null) {
          console.error('SubMapCollection: Cannot find variable subCodes!')
        }
        for (let i = 0; i < v_codes.length; i++) {
          let t_code = v_codes[i].join('')
          this.add(new SubMap_Model({ code: t_code, dimensions: this.dimensions, id: i, collection: this }))
        }
        this.subIndex = v_codes
        this.dataSize = this.sampleCount = v_codes.length
        let t_indeces = this.dataIndeces = new Array()
        for (let i = 0; i < this.sampleCount; i++) {
          t_indeces.push(i)
        }
        console.info('SubMapCollection: Sampling rate: ' + (v_codes.length / t_sum * 100).toFixed(2) + '%')
        v_df.resolve()
      }, true, true)
    },

    getKNNGraphs: function (v_df) {
      this.setStage('KNNGraphs')
      this.trigger('SubMapCollection__Panda', {
        knnK: Config.get('KNN_K'),
        precision: Config.get('KNN_Precision'),
        fileName: this.dataFiles.get('subGraphs')
      }, 'PMSave(subGraphs = KNNGraphs(subCodes, normData, knnK, precision), fileName)', function () {
        if (v_df) {
          v_df.resolve()
        }
      }, true, false)
    },

    getKNNGraphs_load: function (v_df) {
      this.setStage('KNNGraphs_load')
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subGraphs')
      }, 'subGraphs = PMLoad(fileName)', function () {
        if (v_df) {
          v_df.resolve()
        }
      }, true, false)
    },

    getDistances: function (v_df) {
      this.setStage('Distances')
      let t_df0 = $.Deferred()
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subKNNDistr')
      }, 'PMSave(subKNNDistr = KNNGDistribution(subGraphs, knnK), fileName)', function () {
        if (t_df0) {
          t_df0.resolve()
        }
      }, true, false)
      $.when(t_df0).done(() => {
        this.trigger('SubMapCollection__Panda', {
          fileName: this.dataFiles.get('subDataDist')
        }, 'PMSave(subDataDist = KNNGDistance(subKNNDistr, knnK), fileName)', (v_dist) => {
          this.dataDist = v_dist
          if (v_df) {
            v_df.resolve()
          }
        }, true, true)
      })
            // self.trigger("SubMapCollection__Panda",{
            // }, "subDimDist = DimDistance(subCodes)", function(v_dist){
            //     self.dimDist = v_dist;
            //     t_df1.resolve();
            // }, true, true);
    },

    getDistances_load: function (v_df) {
      this.setStage('Distances_load')
      let t_df0 = $.Deferred()
            // this.trigger("SubMapCollection__Panda",{
            //     fileName: this.dataFiles.get("subKNNDistr"),
            // }, "subKNNDistr = PMLoad(fileName)", function(){
            //     if(t_df0){
            //         t_df0.resolve();
            //     }
            // }, true, false);
      this.trigger('SubMapCollection__Panda', {
        knnK: Config.get('KNN_K'),
        fileName: this.dataFiles.get('subKNNDistr')
      }, 'PMSave(subKNNDistr = KNNGDistribution(subGraphs, knnK), fileName)', function () {
        if (t_df0) {
          t_df0.resolve()
        }
      }, true, false)
      $.when(t_df0).done(() => {
        this.trigger('SubMapCollection__Panda', {
          fileName: this.dataFiles.get('subDataDist')
        }, 'subDataDist = PMLoad(fileName)', (v_dist) => {
          if (v_dist == null) {
            console.error('SubMapCollection: Cannot find variable subDataDist!')
          }
          this.dataDist = v_dist
          if (v_df) {
            v_df.resolve()
          }
        }, true, true)
      })
    },

    getSubNeighbors: function (v_df) {
      this.setStage('SubNeighbors')
      let t_df0 = $.Deferred()
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subSortList')
      }, 'PMSave(subSortList = SortbyDistance(subDataDist), fileName)', function () {
        t_df0.resolve()
      }, true, false)
      $.when(t_df0).done(() => {
        this.trigger('SubMapCollection__Panda', {
          subK: Config.get('SUB_K'),
          fileName: this.dataFiles.get('subNghList')
        }, 'PMSave(subNghList = KNNBysort(subSortList, subK), fileName)', (v_nghList) => {
          this.subNghList = v_nghList
          if (v_df) {
            v_df.resolve()
          }
        }, true, true)
      })
    },

    getSubNeighbors_load: function (v_df) {
      this.setStage('SubNeighbors_load')
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subNghList')
      }, 'subNghList = PMLoad(fileName)', (v_nghList) => {
        if (v_nghList == null) {
          console.error('SubMapCollection: Cannot find variable subNghList!')
        }
        this.subNghList = v_nghList
        if (v_df) {
          v_df.resolve()
        }
      }, true, true)
    },

    getColors: function (v_df, v_distMat) {
      if (v_distMat) {
        this.trigger('SubMapCollection__Panda', {
          subDistMat: v_distMat,
          projType: 'MDS',
          projDim: 3
        }, 'localColors = Projection(subDistMat, projType, projDim)', v_proj => {
          v_df.resolve(v_proj)
        }, true, true)
      } else {
        this.trigger('SubMapCollection__Panda', {
          projType: 'MDS',
          projDim: 3,
          fileName: this.dataFiles.get('subColors')
        }, 'PMSave(subColors = Projection(subDataDist, projType, projDim), fileName)', v_proj => {
          this.colors = v_proj
          let t_length = v_proj.length,
            t_tempDist = Basic.initArray(t_length, t_length)
          for (let i = 0; i < t_length - 1; i++) {
            for (let j = i + 1; j < t_length; j++) {
              t_tempDist[i][j] = t_tempDist[j][i] = Basic.getDistance(v_proj[i], v_proj[j])
            }
          }
          this.projDist = t_tempDist
          v_df.resolve()
        }, true, true)
      }
    },

    getColors_load: function (v_df) {
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subColors')
      }, 'subColors = PMLoad(fileName)', v_proj => {
        if (v_proj == null) {
          console.error('SubMapCollection: Cannot find variable subColors!')
        }
        this.colors = v_proj
        let t_length = v_proj.length,
          t_tempDist = Basic.initArray(t_length, t_length)
        for (let i = 0; i < t_length - 1; i++) {
          for (let j = i + 1; j < t_length; j++) {
            t_tempDist[i][j] = t_tempDist[j][i] = Basic.getDistance(v_proj[i], v_proj[j])
          }
        }
        this.projDist = t_tempDist
        v_df.resolve()
      }, true, true)
    },

        // getClsParameters: function(v_dist){
        //         let t_length = v_dist.length,
        //             t_min_elems = Math.round(t_length / 8);
        //         // t_min_elems = t_min_elems < 6?t_min_elems:6;
        //         console.log(t_min_elems);
        //         if(t_min_elems < 2){
        //             t_min_elems = 2;
        //         }
        //         let t_prs = {
        //                 eps: null,
        //                 min_elems: t_min_elems,
        //             };
        //         if(t_prs.min_elems < 1){
        //             t_prs.min_elems = 1;
        //         }
        //         let t_sum = new Array();
        //         for(let i = 0; i < t_length; i++){
        //             let t_dist = new Array(...v_dist[i]);
        //             t_dist.sort();
        //             t_sum.push(t_dist[t_prs.min_elems]);
        //         }
        //         t_sum.sort();
        //         t_prs.eps = eval(t_sum.join("+")) / t_length;
        //         return t_prs;
        // },

    getSubHierClusters: function (v_df, v_isTemp = false, v_length, v_projMat) {
      if (!v_isTemp) {
        this.setStage('SubHierClusters')
      }
      let t_distType = Config.get('clusterDistMat'),
        t_clusterParameters,
        t_clusterCommand,
        t_length = v_isTemp ? v_length : this.sampleCount,
        t_min_elems = Math.round(t_length / 8),
        t_level = this.clusterLevel = Config.get('clusterLevels'),
        t_newMaxLevel = { level: 0 },
        t_save = (v_command) => {
          if (!v_isTemp) {
            return 'PMSave(' + v_command + ', fileName)'
          } else {
            return v_command
          }
        }
      if (t_min_elems < 2) {
        t_min_elems = 2
      }
      let t_fileName = v_isTemp ? '' : this.dataFiles.get('subClusters')
      switch (t_distType) {
        case 'projection':
          t_clusterParameters = {
            'tempDist': v_isTemp ? v_projMat : this.projDist,
            'DC_min_elems': t_min_elems,
            'DC_level': t_level,
            'fileName': t_fileName
          }
          t_clusterCommand = t_save('subClusters = DBSCANHierarchy(tempDist, DC_min_elems, DC_level)')
          break
        case 'original':
          let t_dataDistName = v_isTemp ? 'subDistMat' : 'subDataDist'
          t_clusterParameters = {
            'DC_min_elems': t_min_elems,
            'DC_level': t_level,
            'fileName': t_fileName
          }
          t_clusterCommand = t_save('subClusters = DBSCANHierarchy(' + t_dataDistName + ', DC_min_elems, DC_level)')
          break
      }
      let t_getLevel = this.getLevelFunc
      this.trigger('SubMapCollection__Panda', t_clusterParameters, t_clusterCommand, v_clusters => {
        Config.set('New', v_clusters)
        let t_indeces = new Array()
        for (let i = 0; i < v_clusters.length; i++) {
          t_indeces.push(i)
        }
        let t_cls = t_getLevel(v_clusters, t_indeces, 0, t_level - 1, t_newMaxLevel),
          t_clsLevel = t_newMaxLevel.level
        if (t_clsLevel == 0) {
          t_clsLevel = 1
          t_cls = [t_cls]
        }
        if (!v_isTemp) {
          this.clusters = t_cls
          this.clusterLevel = t_clsLevel
        }
        if (v_df) {
          v_df.resolve(t_cls, t_clsLevel)
        }
      }, true, true)
    },

    getSubHierClusters_load: function (v_df) {
      this.setStage('SubHierClusters_load')
      let t_getLevel = this.getLevelFunc,
        t_newMaxLevel = { level: 0 },
        t_level = this.clusterLevel = Config.get('clusterLevels')
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('subClusters')
      }, 'subClusters = PMLoad(fileName)', v_clusters => {
        if (v_clusters == null) {
          console.error('SubMapCollection: Cannot find variable subClusters!')
        }
        let t_indeces = new Array()
        for (let i = 0; i < v_clusters.length; i++) {
          t_indeces.push(i)
        }
        let t_cls = t_getLevel(v_clusters, t_indeces, 0, t_level - 1, t_newMaxLevel),
          t_clsLevel = t_newMaxLevel.level
        if (t_clsLevel == 0) {
          t_clsLevel = 1
          t_cls = [t_cls]
        }
        this.clusters = t_cls
        this.clusterLevel = t_clsLevel
        if (v_df) {
          v_df.resolve(t_cls, t_clsLevel)
        }
      }, true, true)
    },

    getSubTree: function (v_df) {
      this.setStage('SubTree')
      this.trigger('SubMapCollection__Panda', {}, 'subTree = GetSubtree(subClusters, subCodes, subDataDist, subKNNDistr, subNghList)', v_tree => {
        this.subTree = v_tree
        this.subTree.findByIndex = function (v_clsIDs) {
          if (v_clsIDs == null) {
            return null
          }
          let t_subTree = this
          for (let i = 0; i < v_clsIDs.length; i++) {
            if (t_subTree.children.length == 0 && parseInt(v_clsIDs[i]) == 0) {
              continue
            } else {
              t_subTree = t_subTree.children[v_clsIDs[i]]
            }
          }
          return t_subTree
        }
        if (v_df) {
          v_df.resolve()
        }
      }, true, true)
    },

    getSubTree_load: function (v_df) {
      this.setStage('SubTree_load')
      this.trigger('SubMapCollection__Panda', {}, 'subTree = GetSubtree(subClusters, subCodes, subDataDist, subKNNDistr, subNghList)', v_tree => {
        this.subTree = v_tree
        this.subTree.findByIndex = function (v_clsIDs) {
          if (v_clsIDs == null) {
            return null
          }
          let t_subTree = this
          for (let i = 0; i < v_clsIDs.length; i++) {
            if (t_subTree.children.length == 0 && parseInt(v_clsIDs[i]) == 0) {
              continue
            } else {
              t_subTree = t_subTree.children[v_clsIDs[i]]
            }
          }
          return t_subTree
        }
        if (v_df) {
          v_df.resolve()
        }
      }, true, true)
    },

    getMapInitProjection: function (df) {
      let dcdDistMatrix = this.subTree.data.dcdDistMatrix
      this.trigger('SubMapCollection__Panda', {
        projType: 'MDS',
        projDim: 2,
        mapInitDistMatrix: dcdDistMatrix,
        fileName: this.dataFiles.get('mapInitProjection')
      }, 'PMSave(subProj = Projection(mapInitDistMatrix, projType, projDim), fileName)', projection => {
        this.subTree.data.initProjection = projection
        df.resolve()
      }, true, true)
    },

    getMapInitProjection_load: function (df) {
      this.trigger('SubMapCollection__Panda', {
        fileName: this.dataFiles.get('mapInitProjection')
      }, 'subProj = PMLoad(fileName)', projection => {
        this.subTree.data.initProjection = projection
        df.resolve()
      }, true, true)
    },

    test: function () {
      this.trigger('SubMapCollection__Panda', {
        projType: 'MDS',
        projDim: 2
      }, 'subProj = Projection(subDataDist, projType, projDim)', projection => {
        this.testProjection = projection
      }, true, true)
    },

        // getSubspaceClusters: function(v_df){
        //     let t_distType = Config.get("clusterDistMat"),
        //         t_clusterParameters,
        //         t_clusterCommand,
        //         t_parameters,
        //         t_eps,
        //         t_min_elems;
        //     switch(t_distType){
        //         case "projection":
        //             t_parameters = this.getClsParameters(this.projDist);
        //             t_eps = t_parameters.eps;
        //             t_min_elems = t_parameters.min_elems;
        //             t_clusterParameters = {
        //                 'tempDist': this.projDist,
        //                 'DC_eps': t_eps,
        //                 'DC_min_elems': t_min_elems,
        //             }
        //             t_clusterCommand = "DBSCAN(tempDist, DC_eps, DC_min_elems)";
        //         break;
        //         case "original":
        //             t_parameters = this.getClsParameters(this.dataDist);
        //             t_eps = t_parameters.eps;
        //             t_min_elems = t_parameters.min_elems;
        //             t_clusterParameters = {
        //                 'DC_eps': t_eps,
        //                 'DC_min_elems': t_min_elems,
        //             };
        //             t_clusterCommand = "DBSCAN(subDataDist, DC_eps, DC_min_elems)";
        //         break;
        //     }
        //     this.trigger("SubMapCollection__Panda", t_clusterParameters, t_clusterCommand, v_clusters => {
        //         let t_clusters = {
        //             clusters: new Array(),
        //             outliers: new Array(),
        //         };
        //         for(let i = 0; i < v_clusters.length; i++){
        //             if(v_clusters[i] < 0){
        //                 t_clusters.outliers.push(i);
        //             }else{
        //                 let t_index = v_clusters[i],
        //                     t_cluster = t_clusters.clusters[t_index];
        //                 if(t_cluster == null){
        //                     t_cluster = new Array();
        //                 }
        //                 t_cluster.push(i);
        //                 t_clusters.clusters[t_index] = t_cluster;
        //             }
        //         }
        //         this.clusters = t_clusters;
        //         v_df.resolve();
        //     }, true, true);
        // },

    getProjection: function (v_df) {
      var self = this,
        t_w = Config.get('KNNGDistWeight')
      var t_df0 = $.Deferred(),
        t_df1 = $.Deferred(),
        t_dfs = []
      t_dfs.push(t_df0.promise())
      t_dfs.push(t_df1.promise())
      self.trigger('SubMapCollection__Panda', {
        projType: 'MDS',
        projDim: 2,
        tw: t_w,
        ntw: 1 - t_w
      }, 'subProj = Projection(Multiply(subDataDist, tw) + Multiply(subDimDist, ntw), projType, projDim)', v_proj => {
        this.projection = v_proj
        t_df0.resolve()
      }, true, true)
      self.trigger('SubMapCollection__Panda', {
        projType: 'MDS',
        projDim: 3
      }, 'subColors = Projection(subDataDist, projType, projDim)', v_proj => {
        this.colors = v_proj
        t_df1.resolve()
      }, true, true)
            // t_df1.resolve();
      $.whenWithProgress(t_dfs)
                .done(function () {
                  self.trigger('SubMapCollection__ShowMap')
                  if (v_df) {
                    v_df.resolve()
                  }
                })
            //         self.projection = MDS.byDistance(self.dist);
            //         self.trigger("SubMapCollection__ShowProjection");
    },

    getCoverage: function (v_indeces) {
      let t_dimLength = this.dimCount,
        t_coverage = new Array(t_dimLength),
        t_codes = this.subIndex,
        t_indeces = v_indeces
      if (v_indeces == null) {
        t_indeces = this.dataIndeces
      }
      t_coverage.dimLength = t_dimLength
      t_coverage.dataSize = t_indeces.length
      for (let i = 0; i < t_dimLength; i++) {
        t_coverage[i] = 0
      }
      for (let i = 0; i < t_indeces.length; i++) {
        let t_code = t_codes[t_indeces[i]]
        for (let j = 0; j < t_dimLength; j++) {
          if (t_code[j] == 1) {
            t_coverage[j]++
          }
        }
      }
      return t_coverage
    },

    trainModel: function (v_df) {
      var self = this
      self.trigger('SubMapCollection__Panda', {
        subK: Config.get('SUB_K'),
        modelType: 'LDA',
        modelName: Config.get('currentData') + '_model',
        topicN: Config.get('TOPIC_N')
      }, 'KNNGModel(modelType, subGraphs, subK, topicN, modelName)', v_result => {
        if (v_df) {
          v_df.resolve()
        }
      }, true, false)
    },

    getModel: function (v_df) {
      var self = this
      var t_df0 = $.Deferred(),
        t_df1 = $.Deferred(),
        t_df2 = $.Deferred(),
        t_dfs = []
      t_dfs.push(t_df0.promise())
      t_dfs.push(t_df1.promise())
      t_dfs.push(t_df2.promise())
      self.trigger('SubMapCollection__Panda', {
        oprType: 'get',
        oprTarget: 'wordmap'
      }, 'KNNGOperate(modelName, oprType, oprTarget)', v_result => {
        let t_wordmap = []
        for (let i = 0; i < v_result.length; i++) {
          let t_word = v_result[i],
            t_from = t_word[0],
            t_to = t_word[1]
          let t_name = t_from + '_' + t_to
          t_wordmap[i] = {
            from: t_from,
            to: t_to
          }
        }
        this.tpModel.wordmap = t_wordmap
        t_df0.resolve()
      }, true, true)
      self.trigger('SubMapCollection__Panda', {
        oprType: 'get',
        oprTarget: 'doc_topic'
      }, 'KNNGOperate(modelName, oprType, oprTarget)', v_result => {
        this.tpModel.DTMatrix = v_result
        t_df1.resolve()
      }, true, true)
      self.trigger('SubMapCollection__Panda', {
        oprType: 'get',
        oprTarget: 'topic_word'
      }, 'KNNGOperate(modelName, oprType, oprTarget)', v_result => {
        this.tpModel.TWMatrix = v_result
        t_df2.resolve()
      }, true, true)
      $.whenWithProgress(t_dfs)
                .done(function () {
                  if (v_df) {
                    v_df.resolve()
                  }
                })
    },

    drawModel: function () {
      let t_td = trans(dot(trans(this.subIndex), this.tpModel.DTMatrix))
      for (let i = 0; i < t_td.length; i++) {
        t_td[i] = div(t_td[i], sum(t_td[i]))
      }
      this.tpModel.TDims = t_td
      this.trigger('SubMapCollection__ShowModels')
    },

    binaryRandom: function (v_range, v_limits) {
      var self = this,
        t_dim = self.dimCount,
        t_num, t_st, t_length, t_sign
      while (!t_sign) {
        t_num = _.random(v_range[0], v_range[1]), t_st = t_num.toString(2), t_sign = false, t_length = t_st.length
        if (t_length >= v_limits[0] && t_length <= v_limits[1]) {
          if (t_length < t_dim) {
            for (var i = 0; i < (t_dim - t_length); i++) {
              t_st = '0' + t_st
            }
          }
          var t_arr = t_st.split(''),
            t_count = 0
          for (var i in t_arr) {
            if (t_arr[i] == '1') {
              t_count++
            }
          }
          if (t_count >= v_limits[0] && t_count <= v_limits[1]) {
            t_sign = true
          }
        }
      }
      return t_st
    },

    clearAll: function () {
      this.reset()
      this.initialize()
      this.trigger('SubMapCollection__ClearAll')
    }
  })
  return SubMap_Collection
})
