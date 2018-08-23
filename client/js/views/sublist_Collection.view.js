define([
  'require',
  'marionette',
  'underscore',
  'jquery',
  'backbone',
  'datacenter',
  'config',
  'Base',
  'SubMap_ModelView',
  'basicFunctions',
  'PDHist',
  'perfectScrollbar',
  'SubGlyph'
], function (require, Mn, _, $, Backbone, Datacenter, Config, Base, SubMap_ModelView, loadBasic, pdhist, pfScrollBar, Subglyph) {
  'use strict'

  var SubList_CollectionView = Mn.CollectionView.extend(_.extend({

    tagName: 'div',

    attributes: {
      'id': 'SubList_Old'
    },

    childView: SubMap_ModelView,

    childEvents: {
    },

    childViewOptions: {
      layout: null
    },

    init: function (v_options) {
      let t_parent = this.$el.parent(),
        t_filtStats = ['none', 'on', 'off']
      t_filtStats.next = function (v_i) { return (v_i + 1) % this.length }
      let t_defaults = {
        newData: true,
        overallList: null,
        overallColors: null,
        overallCoverage: null,
        currentList: null,
        currentColors: null,
        selections: null,
        codes: null,
        codeLength: null,
        size: [t_parent.width(), t_parent.height()],
        layout: {
          marginHeight: 0.01, // height
          marginWidth: 0.08,
          toolbarHeight: 0.04, // height
          toolbarWidth: 0.88,
          toolbarMarginWidth: 0.06,
          histWidth: 0.88,
          histHeight: 0.12, // height
          histMarginRatio: 0.02,
          histBarHeight: 0.10,
          filterHeight: 0.06, // height
          filterWidth: 0.88,
          filterMarginWidth: 0.06,
          listWidth: 1.00,
          listHeight: 0.76, // height
          listMargin: 0.00,
          listMarginLimits: [0, 0]
        },
        itemHeightRatio: 0.01,
        itemHeightLimits: [-Infinity, 4],
        itemWidthRatio: 0.84,
        filter: {
          states: t_filtStats,
          currentStates: new Array(),
          locked: null,
          timer: null,
          waitTime: 0,
          glyphToMargin: 20
        },
        animation: {
          short: 400,
          long: 800
        },
        filterers: {
          highlight: BasicView.filter({
            container: this.d3el,
            overallSelector: '.SubListItem',
            overallKey: 'index',
            overallFilterFunc: function (v_d) { return !d3.select(this).classed('locked') },
            subSelector: 'svg',
            controlAttr: 'opacity',
            static: {
              attrs: ['class'],
              match: ['chosen'],
              miss: [null],
              normal: [false]
            },
            animation: {
              attr: 'opacity',
              match: 1.0,
              miss: 0.2,
              duration: 400
            }
          }),
          filterDims: BasicView.filter({
            container: this.d3el,
            overallSelector: '.SubListItem',
            overallKey: 'index',
            controlAttr: 'slider',
            animation: () => {}
          }),
          filterDimsOwnAnimation: {
            attr: 'opacity',
            match: 1.0,
            miss: 0.2,
            duration: 400
          }
        },
        interactions: {
          lockFun: () => {}
        },
        histObj: null,
        initHist: null,
        lastHist: null,
        contextHist: null,
        rememberContext: false,
        dimIndeces: null,
        dataIndeces: null
      }
      v_options = v_options || {}
      _.extend(this, t_defaults)
      _.extend(this, v_options)
    },

    initialize: function () {
      this.init()
      this.bindAll()
    },

    onShow: function () {
      if (!this.ready) {
        let t_parent = this.$el.parent()[0]
        d3.selectAll('#SubList_Old')
                    .remove()
        d3.select(t_parent)
                    .style('width', '100%')
                    .style('height', '100%')
                    .append('div')
                    .attr('id', 'SubList_View')
                    .style('width', '100%')
                    .style('height', '100%')
        this.$el = $('#SubList_View')
        this.d3el = d3.select(this.$el[0])
        this.setElement(this.$el)
        this.ready = true
      }
    },

    initList: function (v_cls) {
      let t_codeLength = this.codeLength = this.codes[0].length
      class listItems {
        constructor (v_id, v_codes, v_col) {
          this.id = (v_id == null ? -1 : v_id)
          this.code = (v_codes == null ? (new Array(t_codeLength).fill(0)) : v_codes)
          this.color = null
          this.array = null
          if (v_col != null) {
            let t_col = new Array()
            for (let i = 0; i < v_col.length; i++) {
              t_col.push(~~(v_col[i] * 255))
            }
            this.color = 'rgb(' + t_col + ')'
          }
        };
        static higherThan (v_item1, v_item2, v_supernode) {
          let t_thisCode = v_item1.code, t_thatCode = v_item2.code, t_higher
          if (v_supernode) {
            for (let i = 0; i < t_thisCode.length; i++) {
              if (t_thisCode[i] != t_thatCode[i]) {
                t_higher = (t_thisCode[i] > t_thatCode[i])
                break
              }
            }
          } else {
            let t_thisLength = eval(t_thisCode.join('+')),
              t_thatLength = eval(t_thatCode.join('+'))
            if (t_thisLength != t_thatLength) {
              t_higher = (t_thisLength < t_thatLength)
            } else {
              for (let i = 0; i < t_thisCode.length; i++) {
                if (t_thisCode[i] != t_thatCode[i]) {
                  t_higher = (t_thisCode[i] > t_thatCode[i])
                  break
                }
              }
            }
          }
          return t_higher
        };
        addup (v_item) {
          let t_thisCode = this.code, t_thatCode = v_item.code
          for (let i = 0; i < t_thisCode.length; i++) {
            t_thisCode[i] += t_thatCode[i]
          }
        };
                };
      let t_subTreeFunc = (v_subNodes, v_treePath) => {
          let t_level_list = new Array(), t_superLeaf = new listItems(),
            t_leavesArray = new Array()
          for (let i = 0; i < v_subNodes.length; i++) {
            t_level_list.push(v_subNodes[i].supernode)
            t_superLeaf.addup(v_subNodes[i].supernode)
          }
          t_level_list.sort((v_a, v_b) => { return listItems.higherThan(v_a, v_b) })
          for (let i = 0; i < t_level_list.length; i++) {
            t_leavesArray.push(...t_level_list[i].array)
          }
          t_superLeaf.array = t_leavesArray
          return t_superLeaf
        },
        t_leavesFunc = (v_leaves, v_onlyLeaves, v_treePath) => {
          let t_leaves = new Array(), t_superLeaf = new listItems()
          for (let i = 0; i < v_leaves.length; i++) {
            let t_ind = v_leaves[i],
              t_newLeaf = new listItems(t_ind, this.codes[t_ind], this.currentColors[t_ind])
            t_leaves.push(t_newLeaf)
            t_superLeaf.addup(t_newLeaf)
          }
          t_leaves.sort((v_a, v_b) => { return listItems.higherThan(v_b, v_a) })
          t_superLeaf.array = t_leaves
          return {
            supernode: t_superLeaf,
            leafnode: v_leaves
          }
        }
      let t_listTree = Basic.traverseTree(v_cls, t_subTreeFunc, t_leavesFunc)
      return t_listTree.supernode
    },

    updateParameters: function (v_data) {
      let t_changed = v_data.mapChanged,
        t_ratio = this.size[1] / this.size[0]
      this.codes = v_data.codes
      if (this.newData) {
        this.currentColors = this.overallColors = v_data.colors
        this.currentList = this.overallList = this.initList(v_data.clusters)
      } else {
        if (t_changed) {
          this.currentColors = v_data.colors
          this.currentList = this.initList(v_data.clusters)
        } else {
          this.currentColors = this.overallColors
          this.currentList = this.overallList
        }
      }
      this.sellections = v_data.selections
      this.dimNames = v_data.dimensions
      this.dimIndeces = v_data.dimIndeces
      this.dataIndeces = v_data.dataIndeces
      this.itemHeightRatio = this.itemWidthRatio / t_ratio * (0.5 / this.dimNames.length)
      this.showList()
    },

    showList: function (v_cls) {
      if (this.newData) {
        this.clearCanvas()
      } else {
        this.transCanvas()
      }
      this.pipeline()
      this.newData = false
    },

    bindAll: function () {
      this.listenTo(this.collection, 'SubListCollection__UpdateData', this.clearAll)
      this.listenTo(Datacenter, 'SubMapCollectionView__UpdateMap', this.updateParameters)
      this.listenTo(Datacenter, 'SubMapCollectionView__Filtering', this.updateFiltering)
      this.listenTo(Datacenter, 'SubMapCollectionView__Choose', this.updateHighlighting)
      this.listenTo(Datacenter, 'SubMapCollectionView__Pin', this.updatePinning)
      this.listenTo(Datacenter, 'SubMapCollectionView__updateDimCoverage', this.showHistograms)
    },

    pipeline: function () {
                // test here
/*                this.showToolbar(); */
      this.showFiltering()
      this.showHistograms()
      this.showItems()
    },

    showToolbar: function () {
      if (this.newData) {
        let t_d3el = this.d3el,
          t_g = t_d3el.append('div')
                        .attr('class', 'SubListToolbar')
                        .style('width', this.layout.toolbarWidth * 100 + '%')
                        .style('height', this.layout.toolbarHeight * 100 + '%'),
          t_size = this.size,
          t_width = parseFloat($('.SubListToolbar').css('width')),
          t_height = parseFloat($('.SubListToolbar').css('height')),
          t_marginWidth = t_size[0] * this.layout.toolbarMarginWidth,
          t_marginHeight = t_size[1] * this.layout.marginHeight,
          t_lockText = $('.hiddenIcon #Lock').get(0).innerHTML,
          t_unlockText = $('.hiddenIcon #LockOpen').get(0).innerHTML,
          t_collection = this.collection,
          t_filter = this.filter,
          t_lockFunc = this.interactions.lockFunc = (v_isLock) => {
            return function (v_lock) {
              let t_dimCover = t_filter.currentStates,
                t_illegal = (t_dimCover.filter((v_d) => { return v_d != 0 }).length < 2)
              if (!t_illegal) {
                t_d3el.selectAll('.filterBtn.active')
                                    .each(function () {
                                      d3.select($(this).parent()[0]).classed('locked', v_isLock)
                                    })
                t_collection
                                    .trigger('Transmission', {
                                      type: 'trans',
                                      message: 'SubListCollectionView__ZoomByDims',
                                      data: {
                                        dims: t_filter.currentStates,
                                        zoomin: v_isLock
                                      }
                                    })
              }
            }
          }
        t_g.style('margin-left', t_marginWidth + 'px')
                    .style('margin-top', t_marginHeight + 'px')
                    .style('margin-bottom', t_marginHeight + 'px')
        let t_lockBtn = t_g.append('div').attr('class', 'SubListTool lockBtn').style('line-height', t_height + 'px'),
          t_unlockBtn = t_g.append('div').attr('class', 'SubListTool unlockBtn').style('line-height', t_height + 'px')
        $(t_lockBtn.node()).css('margin-top', t_height * 0.1).css('height', t_height * 0.8)
        $(t_unlockBtn.node()).css('margin-top', t_height * 0.1).css('height', t_height * 0.8)
        t_lockBtn
                    .on('click', t_lockFunc(true))
                    .append('span')
                    .attr('class', 'iconFontello SubListDimLock')
                    .style('line-height', t_height * 0.8 + 'px')
                    .text(t_lockText)
        t_unlockBtn
                    .on('click', t_lockFunc(false))
                    .append('span')
                    .attr('class', 'iconFontello SubListDimLock')
                    .style('line-height', t_height * 0.8 + 'px')
                    .text(t_unlockText)
                    // .on("click", function(){
                    //     let t_d3 = d3.select(this), t_unlock = t_d3.classed("unlock");
                    //     if(!t_d3.classed("active")){
                    //         return;
                    //     }
                    //     t_d3.text(t_unlock?t_lockText:t_unlockText);
                    //     t_d3.classed("unlock", !t_unlock);
                    //     d3.select($(this).parent()[0]).classed("locked", t_unlock);
                    //     t_this.collection
                    //     .trigger("Transmission", {
                    //         type: "trans",
                    //         message: "SubListCollectionView__ZoomByDims",
                    //         data: {
                    //             dims: t_this.filter.currentStates,
                    //             zoomin: t_unlock,
                    //         },
                    //     });
                    // });
      }
    },

    updateHistograms: function (v_ids) {
      if (v_ids != null) {
        v_ids = new Set(v_ids)
        v_ids = Basic.mapToArray(v_ids)
        if (!Basic.sameArray(v_ids, this.lastHist)) {
          this.lastHist = v_ids
          this.collection.trigger('Transmission', {
            type: 'trans',
            message: 'SubListCollectionView__getDimensionCoverage',
            data: v_ids
          })
        }
      } else {
        if (!this.newData) {
          this.lastHist = null
          this.showHistograms()
        }
      }
    },

    showHistograms: function (v_data) {
      if (this.histObj == null) {
        this.histObj = {}
        this.collection.trigger('Transmission', {
          type: 'trans',
          message: 'SubListCollectionView__getDimensionCoverage',
          data: this.dataIndeces
        })
        return
      } else {
        this.histObj.ready = true
      }
      if (this.rememberContext) {
        this.rememberContext = false
        this.contextHist = v_data
      }
      if (this.newData && this.histObj && this.histObj.ready) {
        this.initHist = v_data
        let t_this = this.d3el,
          t_dimLength = this.dimNames.length,
          t_width = this.size[0] * this.layout.filterWidth,
          t_height = this.size[1] * this.layout.histBarHeight,
          t_marginWidth = this.size[0] * this.layout.filterMarginWidth,
          t_marginHeight = this.size[1] * this.layout.marginHeight,
          t_g = t_this.append('div')
                        .attr('class', 'SubListHistograms')
                        .style('width', this.layout.histWidth * 100 + '%')
                        .style('height', this.layout.histBarHeight * 100 + '%')
                        .style('margin-top', t_marginHeight + 'px')
                        .style('margin-left', t_marginWidth + 'px')
                        .append('svg')
                        .attr('width', t_width)
                        .attr('height', t_height),
          t_hist = this.histObj = PandaHist.init({
            container: t_g,
            className: 'SubListHistogram',
            size: [t_width, t_height],
            data: v_data,
            dataRange: [0, v_data.dataSize],
            barToMargin: this.filter.glyphToMargin,
            barWidth: 0.6
          })
        BasicView.showOnTop('.SubListFilters', this.$el[0])
        t_hist.show()
      } else {
        let t_data = (v_data == null) ? (this.contextHist ? this.contextHist : this.initHist) : v_data
        this.histObj.update(t_data, [0, t_data.dataSize])
      }
    },

    showFiltering: function () {
      let t_this = this,
        t_stateArr = this.filter.states,
        t_handleFilter = (v_dimStateIDs) => {
          clearTimeout(this.filter.timer)
          this.filter.timer = setTimeout(() => {
            let t_dInds = this.dimIndeces,
              t_dStates = new Array(this.codeLength).fill(-1),
              t_returnStates = new Array(v_dimStateIDs.length),
              t_needToFilter = false
            for (let i = 0; i < t_dInds.length; i++) {
              let t_ind = t_dInds[i],
                t_stateID = v_dimStateIDs[t_ind],
                t_state
              switch (t_stateID) {
                case 0:
                  t_state = -1
                  break
                case 1:
                  t_state = 1
                  t_needToFilter = true
                  break
                case 2:
                  t_state = 0
                  t_needToFilter = true
                  break
              }
              t_dStates[t_ind] = t_state
              t_returnStates[i] = t_state
            }
            t_returnStates.needed = t_needToFilter
            this.filter.currentStates = t_dStates
            this.collection
                            .trigger('Transmission', {
                              type: 'trans',
                              message: 'SubListCollectionView__FilterByDims',
                              data: t_returnStates
                            })
          }, this.filter.waitTime)
        }
      if (this.newData) {
        let t_width = this.size[0] * this.layout.filterWidth,
          t_height = this.size[1] * this.layout.filterHeight,
          t_marginWidth = this.size[0] * this.layout.filterMarginWidth,
          t_marginHeight = this.size[1] * this.layout.marginHeight,
          t_g = this.d3el.append('div')
                        .attr('class', 'SubListFilters')
                        .style('width', this.layout.filterWidth * 100 + '%')
                        .style('height', this.layout.filterHeight * 100 + '%')
                        .style('margin-left', t_marginWidth + 'px')
                        .style('margin-bottom', t_marginHeight + 'px'),
          t_dimLength = this.dimNames.length,
          t_placement = BasicView.placeEvenly([t_width, t_height], this.filter.glyphToMargin, t_dimLength),
          t_glyphSize = t_placement.glyphSize,
          t_r = t_glyphSize / 2,
          t_filterDims = new Array(t_dimLength).fill(0)
        this.filter.glyphToMargin = t_placement.glyphToMarginRatio
        let t_buttong = t_g.append('svg')
                        .attr('width', t_width)
                        .attr('height', t_height)
                        .selectAll('.SubListDims')
                        .data(this.dimNames)
                        .enter()
                        .append('g')
                        .attr('class', 'SubListDims none')
                        .attr('dimID', (v_name, v_i) => {
                          return v_i
                        })
                        .attr('dimName', (v_name) => {
                          return v_name
                        })
                        .attr('stateID', 0)
                        .attr('transform', (v_name, v_i) => {
                          return 'translate(' + t_placement.glyphs[v_i] + ')'
                        })
        let t_onClick = function (v_stateID) {
          return function (v_name, v_i) {
            let t_parent = d3.select($(this).parent()[0])
            if (t_parent.classed('locked')) {
              return
            }
            let t_d3 = d3.select(this), t_active = t_d3.classed('active'), t_stateID = 0,
              t_radius = parseFloat(t_d3.attr('radius'))
            if (t_active) {
              t_d3.classed('active', false)
              t_parent.attr('stateID', 0)
              t_parent.select('.filterBtnFramework').classed('active', false)
              t_parent.select('.SubListDimLock').classed('active', false)
              t_d3.interrupt().transition().attr('r', t_radius * 0.25)
            } else {
              t_parent.selectAll('.active').classed('active', false)
                                .interrupt().transition().attr('r', t_radius * 0.25)
              t_d3.classed('active', true)
              t_parent.attr('stateID', v_stateID)
              t_parent.select('.filterBtnFramework').classed('active', true)
              t_parent.select('.SubListDimLock').classed('active', true)
              t_d3.interrupt().transition().attr('r', t_radius * 0.35)
              t_stateID = v_stateID
            }
            t_filterDims[v_i] = t_stateID
            t_handleFilter(t_filterDims)
          }
        }
        let t_marginTop = 0// (t_height - t_r) / 2;
        t_buttong
                    .append('rect')
                    .attr('class', 'filterBtnFramework')
                    .attr('x', t_r * 0.2)
                    .attr('y', t_marginTop)
                    .attr('rx', t_r * 0.4)
                    .attr('ry', t_r * 0.4)
                    .attr('width', t_r * 1.8)
                    .attr('height', t_r * 1)
        t_buttong
                    .append('circle')
                    .attr('class', 'filterBtn on')
                    .attr('cx', t_r * 0.65)
                    .attr('cy', t_r * 0.5 + t_marginTop)
                    .attr('radius', t_r)
                    .attr('r', t_r * 0.25)
                    .on('click', t_onClick(1))
        t_buttong
                    .append('circle')
                    .attr('class', 'filterBtn off')
                    .attr('cx', t_r * 1.55)
                    .attr('cy', t_r * 0.5 + t_marginTop)
                    .attr('radius', t_r)
                    .attr('r', t_r * 0.25)
                    .on('click', t_onClick(2))
        let t_texts = new Array()
        t_buttong.each((v_d, v_i) => {
          let t_text = v_d
          if (t_text.length > 4) {
            t_text = t_text.slice(0, 4) + '...'
          }
          t_texts[v_i] = t_text
        })
        let t_textRotateAng = 20,
          t_textRotateArc = Math.PI * (t_textRotateAng / 180),
          t_top = t_marginTop + t_r * 1
        t_buttong
                    .append('text')
                    .attr('size', function (v_name, v_i) {
                      let t_text = t_texts[v_i]
                      return t_text.visualSize(10).join('_')
                    })
                    .attr('transform', function () {
                      let t_size = d3.select(this).attr('size').split('_'),
                        t_trans = [parseFloat(t_size[0]), parseFloat(t_size[1])]
                      t_trans[0] = t_r * 0.4// t_trans[0] * Math.cos(t_textRotateArc) * 0.5;
                      t_trans[1] = t_top + t_trans[1] * Math.cos(t_textRotateArc) * 0.5
                      return 'translate(' + t_trans + ')rotate(' + t_textRotateAng + ')'
                    })
                    .attr('x', 0)
                    .attr('y', 0)
                    .text(function (v_name, v_i) {
                      return t_texts[v_i]
                    })
      }
    },

    updateHighlighting: function (v_options) {
      let t_filterer = this.filterers.highlight,
        t_attr = v_options.attr,
        t_highlightIDs = v_options.IDs,
        t_informOthers = v_options.inform,
        t_result
      if (!t_filterer.ready) {
        t_filterer.init()
      }
      if (t_highlightIDs != null && t_highlightIDs.length > 0) {
        t_result = t_filterer.filter('sublist_highlighting', t_attr, t_highlightIDs)
      } else {
        t_result = t_filterer.restore('sublist_highlighting')
      }
      if (t_informOthers) {
        this.collection
                    .trigger('Transmission', {
                      type: 'trans',
                      message: 'SubListCollectionView__FilterByIDs',
                      data: t_highlightIDs
                    })
      }
      let t_ids = BasicView.getFromSelection(t_result, 'index')
      this.updateHistograms(t_ids)
    },

    updatePinning: function (v_options) {
      let t_filterer = this.filterers.highlight,
        t_attr = v_options.attr,
        t_pinIDs = v_options.IDs,
        t_informOthers = v_options.inform,
        t_d3 = v_options.d3,
        t_d3el = this.d3el,
        t_result
      if (!t_filterer.ready) {
        t_filterer.init()
      }
      t_d3el.selectAll('.SubListItem')
                .classed('pinned', false)
      if (t_pinIDs != null && t_pinIDs.length > 0) {
        t_result = t_filterer.pick('sublist_pinning', t_attr, t_pinIDs)
        if (t_d3 != null) {
          t_d3.classed('pinned', true)
        } else {
          let t_idSet = new Set(t_pinIDs)
          t_d3el.selectAll('.SubListItem')
                        .filter(function () {
                          let t_id = d3.select(this).attr('index')
                          if (t_id == null) {
                            return false
                          } else {
                            return t_idSet.has(t_id)
                          }
                        })
                        .classed('pinned', true)
        }
      } else {
        t_result = t_filterer.restore('sublist_pinning')
      }
      if (t_informOthers) {
        this.collection
                    .trigger('Transmission', {
                      type: 'trans',
                      message: 'SubListCollectionView__PinByIDs',
                      data: t_pinIDs
                    })
      }
      let t_ids = BasicView.getFromSelection(t_result, 'index')
      this.updateHistograms(t_ids)
    },

    updateFiltering: function (v_filterObj) {
      let t_filterer = this.filterers.filterDims,
        t_hlFilter = this.filterers.highlight,
        t_animation = this.filterers.filterDimsOwnAnimation,
        t_d3el = this.d3el, t_result,
        t_filterIDs = (v_filterObj != null) ? (v_filterObj.indeces) : null,
        t_illegal = (v_filterObj != null) ? (v_filterObj.illegal) : false
      if (t_filterIDs == null && !t_illegal) {
        if (!t_hlFilter.ready) {
          t_hlFilter.init()
        }
        if (!t_filterer.ready) {
          this.rememberContext = false
          let t_animate = function (v_d3Selection, v_fit) {
            let t_objs = v_d3Selection[0]
            if (t_objs.length > 0) {
              let t_noPickers = t_d3el.select('.pinned').empty(),
                t_opc = v_fit ? t_animation.match : t_animation.miss
              if (v_fit) {
                $(t_objs).slideDown()
              } else {
                $(t_objs).slideUp()
              }
              v_d3Selection.selectAll('svg')
                                .interrupt()
                                .transition()
                                .duration(t_animation.duration)
                                .attr(t_animation.attr, t_noPickers ? t_opc : t_animation.miss)
            }
          }
          t_filterer.animation = t_animate
          t_filterer.init()
        }
        t_result = t_filterer.restore('sliding', true)
      } else {
        if (t_illegal) {
          t_filterIDs = new Array()
        }
        this.rememberContext = true
        let t_IDBook = new Array()
        for (let i = 0; i < t_filterIDs.length; i++) {
          t_IDBook.push(t_filterIDs[i] + '')
        }
        t_result = t_filterer.filterChange('sliding', 'index', t_IDBook, null, true)
        if (t_hlFilter.getOther('reduce').length == 0) {
          t_hlFilter.set('reduce', t_filterer.get('reduce'))
        }
      }
      let t_ids = BasicView.getFromSelection(t_result, 'index')
      this.updateHistograms(t_ids)
    },

    showItems: function () {
      let t_allLength = this.currentList.array.length,
        t_layout = this.layout,
        t_itemWidth = this.size[0] * this.itemWidthRatio,
        t_itemHeight = this.size[1] * this.itemHeightRatio,
        t_marginHeight = this.size[1] * t_layout.listMargin,
        t_this = this
      if (this.newData) {
        let t_list = this.d3el.append('div')
                        .attr('class', 'SubListItems')
                        .style('width', this.layout.listWidth * 100 + '%')
                        .style('height', this.layout.listHeight * 100 + '%')
                        .style('margin-bottom', t_marginHeight + 'px'),
          t_glyphType = Config.get('listType'),
          t_innerWidthRatio = 0.95,
          t_innerHeightRatio = 0.95,
          t_innerMarginRatio = 0.025,
          t_itemGlyph
        t_itemHeight = Basic.trimNumber(t_itemHeight, this.itemHeightLimits)
        t_marginHeight = Basic.trimNumber(t_marginHeight, t_layout.listMarginLimits)
        t_itemGlyph = SubGlyph.getRectGlyph({
          dimLength: this.codeLength,
          size: [t_itemWidth * t_innerWidthRatio, t_itemHeight * t_innerHeightRatio],
          margin: [t_itemWidth * (1 - t_innerWidthRatio) * 0.5, t_itemHeight * (1 - t_innerHeightRatio) * 0.5],
          className: 'SubListItemGlyph',
          type: t_glyphType
        })
        $('.SubListItems').perfectScrollbar({wheelSpeed: 0.5})
        let t_parentDiv = t_list.selectAll('.SubListItem')
                        .data(this.currentList.array)
                        .enter()
                        .append('div')
                        .attr('class', 'SubListItem')
                        .attr('index', (v_listItem, v_i) => { return v_listItem.id })
                        .style('margin-bottom', t_marginHeight + 'px')
                        .each(function (v_listItem, v_i) {
                          let t_code = v_listItem.code
                          let t_svg = d3.select(this)
                                .append('svg')
                                .style('left', t_layout.marginWidth * 100 + '%')
                                .attr('width', t_itemWidth + 'px')
                                .attr('height', t_itemHeight + 'px')
                          t_svg.append('g')
                            .attr('transform', 'translate(' + [t_itemWidth * t_innerMarginRatio, 0] + ')')
                            .append('rect')
                            .attr('x', 1)
                            .attr('y', 1)
                            // .attr("rx", 10)
                            // .attr("ry", 10)
                            .attr('width', t_itemWidth * t_innerWidthRatio + 'px')
                            .attr('height', t_itemHeight * t_innerHeightRatio + 'px')
                            .attr('fill', (v_listItem, v_i) => {
                              return v_listItem.color
                            })
                            .attr('class', 'SubListItemBackground')
                          let t_g = t_svg.append('g')
                                .attr('transform', 'translate(' + [t_itemWidth * t_innerMarginRatio, t_itemHeight * t_innerMarginRatio] + ')')
                          t_itemGlyph.show(t_g, t_code)
                          t_svg.append('g')
                            .attr('transform', 'translate(' + [t_itemWidth * t_innerMarginRatio, 0] + ')')
                            .append('rect')
                            .attr('x', 1)
                            .attr('y', 1)
                            // .attr("rx", 10)
                            // .attr("ry", 10)
                            .attr('width', t_itemWidth * t_innerWidthRatio + 'px')
                            .attr('height', t_itemHeight * t_innerHeightRatio + 'px')
                            .attr('class', 'SubListItemForeground')
                          d3.select(this)
                            .on('mouseover', () => {
                              if (d3.select(this).classed('pinned')) {
                                return
                              }
                              t_this.updateHighlighting({
                                attr: 'index',
                                IDs: [v_listItem.id + ''],
                                inform: true
                              })
                            })
                            .on('mouseout', () => {
                              if (d3.select(this).classed('pinned')) {
                                return
                              }
                              t_this.updateHighlighting({
                                attr: 'index',
                                inform: true
                              })
                            })
                            .on('click', function () {
                              let t_d3 = d3.select(this), t_chosen = t_d3.classed('pinned')
                              if (!t_chosen) {
                                t_this.updatePinning({
                                  attr: 'index',
                                  IDs: [v_listItem.id + ''],
                                  inform: true,
                                  d3: t_d3
                                })
                              } else {
                                t_this.updatePinning({
                                  attr: 'index',
                                  inform: true,
                                  d3: t_d3
                                })
                              }
                            })
                        })
        this.updateFiltering()
      } else {
        let t_list = this.currentList.array,
          t_length = t_list.length,
          t_indeces = this.dataIndeces,
          t_nameBook = new Map(),
          t_colors = this.currentColors
        if (t_indeces == null || t_indeces.length == 0) {
          for (let i = 0; i < t_length; i++) {
            t_nameBook.set(i + '', i + '')
          }
        } else {
          for (let i = 0; i < t_length; i++) {
            t_nameBook.set(t_indeces[i] + '', i + '')
          }
        }
        this.d3el.selectAll('.SubListItem')
                    .filter(function () {
                      let t_index = d3.select(this).attr('index')
                      if (!t_nameBook.has(t_index)) {
                        d3.select(this).classed('locked', true)
                        $(this).slideUp()
                      } else {
                        let t_newID = t_nameBook.get(t_index),
                          t_listItem = t_list.filter((v_item) => { return ((v_item.id + '') == t_newID) })[0]
                        d3.select(this).classed('locked', false)
                            .selectAll('.SubListItemBackground')
                            .interrupt()
                            .transition()
                            .duration(t_this.animation.long)
                            .ease('linear')
                            .attr('fill', t_listItem.color)
                            // $(this).slideDown();
                      }
                    })
      }
    },

    clearAll: function () {
      this.init()
    },

    clearCanvas: function () {
      let t_remove = (v_selector) => { this.d3el.selectAll(v_selector).remove() }
      t_remove('.SubListToolbar')
      t_remove('.SubListHistograms')
      t_remove('.SubListFilters')
      t_remove('.SubListItems')
    },

    transCanvas: function () {

    }
  }, Base))

  return SubList_CollectionView
})
