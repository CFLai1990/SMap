class Visible {
  constructor (parent, center, ringDiameter, glyphSize, clusterLevel, colors) {
    let extent = [1, Math.sqrt(clusterLevel) + 1]
    let maxLevel = Math.log(Math.pow(extent[1], 4)) / Math.log(2)
    let zoomer = d3.behavior.zoom()
      .translate([0, 0])
      .scale(1)
      .scaleExtent(extent)
      .on('zoom', e => {
        let translate = d3.event.translate
        let scale = d3.event.scale
        d3.select('.SubMapTiling').attr('transform', 'translate(' + translate + ')scale(' + scale + ')')
        this.update(translate, scale)
      })
    this.center = center
    this.diameter = ringDiameter
    this.glyphSize = glyphSize
    this.clsLevel = clusterLevel
    this.colors = colors
    this.parent = parent
    this.zoom = {
      extent: extent,
      maxLevel: maxLevel,
      zoomer: zoomer
    }
    this.container = null
    this.ctr = maxLevel / clusterLevel
    this.clsToScale = clusterLevel => { return Math.pow(Math.pow(2, clusterLevel * this.ctr), 0.25) }
  } // end of constructor of Visible

  update (translate, scale, duration = t_duration) {
    let t_level = Math.log(Math.pow(scale, 4)) / Math.log(2)
    let ctr = this.ctr
    let t_div = ctr * 0.5
    let t_this = this.parent
    let clusterPaths = t_this.currentCls.paths
    let scales = t_this.scales
    let t_ringRRatio = t_this.snapshotPar.ringRRatio
    let t_transform = BasicView.getTransform(t_this.d3el.select('.SubMapTiling').attr('transform'))
    let pointVisible = v_pos => {
      v_pos[0] = v_pos[0] * scale - this.center[0] + translate[0]
      v_pos[1] = v_pos[1] * scale - this.center[1] + translate[1]
      let t_pr = Math.sqrt(
        v_pos[0] * v_pos[0] + v_pos[1] * v_pos[1]
      )
      return (t_pr + this.glyphSize * scale <= this.diameter * t_ringRRatio - 8 * 0.9)
    } // end of pointVisible

    let changeVisible = (v_selection, v_visibleFunc, v_givenOpc = false) => {
      v_selection.interrupt()
        .transition()
        .duration(duration)
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
    } // end of changeVisible
    let SubClsVisible = v_baseLineFunc => {
      let t_clsVisibleFunc = v_gCls => {
        let t_visible
        if (!d3.select(v_gCls).classed('Outliers')) {
          let t_clsID = d3
            .select(v_gCls)
            .attr('clsID')
            .split('_')
          let t_baseline = (t_clsID.length - 1) * ctr
          t_visible = t_level >= t_baseline - t_div && t_level < t_baseline + t_div
          t_clsVisible[t_clsID.length - 1].atLevel = t_visible
        } else {
          let t_baseline = (this.clsLevel - 1) * ctr
          t_visible = t_level < t_baseline + t_div
        }
        return t_visible
      }
      let t_Cls = t_this.d3el.selectAll('.SubMapClusters')
      changeVisible(t_Cls, t_clsVisibleFunc)
      t_this.d3el
        .selectAll('.visible .SubClsPath')
        .each(function (v_path) {
          let t_pos = d3
            .select(this)
            .attr('pos')
            .split('_'),
            t_lineVisible = pointVisible(t_pos[0].split(',')) && pointVisible(t_pos[1].split(','))
          d3
            .select(this)
            .attr('display', t_lineVisible ? 'block' : 'none')
        })
    } // end of SubClsVisible
    let SubGlyphVisible = () => {
      let glyphVisibleFunc = v_gCls => {
        let t_baseline = this.clsLevel * ctr
        if (t_level >= t_baseline - t_div && t_level < t_baseline + t_div) {
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
      } // end of glyphVisibleFunc
      let t_Cls = t_this.d3el.selectAll('.dimFan')
      changeVisible(t_Cls, glyphVisibleFunc, true)
    } // end of SubGlyphVisible
    let SubGridVisible = () => {
      let t_visible = new Set(),
        invisible = false
      t_this.d3el
        .selectAll('.SubMapGrids')
        .classed('visible', false)
        .classed('invisible', true)
        .interrupt()
        .transition()
        .duration(duration)
        .attr('opacity', 0)
      let t_dictionary = t_clsVisible.dictionary,
        t_visible_gs = t_this.d3el
        .selectAll('.SubMapGrids')
        .filter(function (v_grid) {
          let t_pos = d3
            .select(this)
            .attr('position')
            .split('_'),
            t_isVisible = pointVisible(t_pos),
            t_id = v_grid.id
          if (t_isVisible && t_id != null) {
            t_visible.add(t_id)
            let t_glbPos = Basic.scale(scales, v_grid.pos),
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
        .duration(duration)
        .attr('opacity', function () {
          let t_this = d3.select(this)
          let t_zgOpc = parseFloat(t_this.attr('zgOpacity'))
          let t_ftOpc = parseFloat(t_this.attr('ftOpacity'))
          let t_ptOpc = parseFloat(t_this.attr('ptOpacity'))
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
    } // end of SubGridVisible
    let SubSnapshotVisible = v_init => {
      let t_clsVisible = t_this.currentCls.visible
      if (v_init) {
        if (t_clsVisible == null) {
          t_clsVisible = t_this.currentCls.visible = []
          t_clsVisible.dictionary = new Map()
          let t_paths = t_this.currentCls.paths
          for (let i = 0; i < t_paths.length; i++) {
            let t_levelPaths = t_paths[i]
            let t_levelVisible = []
            t_levelVisible.atLevel = false
            for (let j = 0; j < t_levelPaths.length; j++) {
              let t_outlier = t_levelPaths[j].outlier
              if (!t_outlier) {
                let t_ids = t_levelPaths[j].ids
                for (let k = 0; k < t_ids.length; k++) {
                  t_levelVisible.push({
                    index: [j, k],
                    clsID: [...t_levelPaths[j].previous, k].join('_'),
                    visible: false,
                    positions: [],
                    colors: [],
                    avgPos: null,
                    avgCol: Basic.getMeanVector(Basic.subArray(this.colors, t_ids[k], [0, 1, 2]), false),
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
              let t_levelVisible = this[i]
              let t_found = false
              let t_foundPath = []
              let t_dictionary = this.dictionary
              for (let j = 0; j < t_levelVisible.length; j++) {
                let t_visibleItem = t_levelVisible[j],
                  t_index = t_visibleItem.index,
                  t_ids =
                  clusterPaths[i][t_index[0]].ids[t_index[1]],
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
          t_clsVisible.updateColors = function (colorsMap) {
            let t_duration = t_this.transition.short
            t_this.d3el
              .selectAll('.SubMapSShot')
              .filter(function () {
                let t_index = d3.select(this).attr('index'),
                  t_return = false
                if (colorsMap.has(t_index)) {
                  t_return = true
                  let t_col = Basic.getMeanVector(
                    colorsMap.get(t_index),
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
          t_angles = [],
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
              t_levelVisibleItem.positions = []
              t_levelVisibleItem.SShotAngle = t_angle
            }
            if (t_levelVisibleItem.colors.length > 0) {
              t_levelVisibleItem.avgCol = Basic.getMeanVector(
                t_levelVisibleItem.colors,
                false
              )
              t_levelVisibleItem.colors = []
            }
          }
        }
      }
      return t_clsVisible
    } // end of SubSnapshotVisible
    let t_clsVisible = SubSnapshotVisible(true)
    SubClsVisible()
    SubGlyphVisible()
    SubGridVisible()
    SubSnapshotVisible()
    t_this.updateClusterInfo(false)
  } // end of update
  toLevel (center, v_level, duration) {
    let t_scale = this.clsToScale(v_level)
    let t_trans = [-center[0] * t_scale, -center[1] * t_scale]
    let t_newTransform = 'translate(' + t_trans + ')scale(' + t_scale + ')'
    let zoomer = this.zoom.zoomer
    let t_oldTrans = zoomer.translate()
    let t_oldScale = zoomer.scale()
    let t_oldTransform = 'translate(' + t_oldTrans + ')scale(' + t_oldScale + ')'
    let t_tolerance = this.parent.sizeTolr
    let t_needToChange = true
    if (Math.abs(t_trans[0] - t_oldTrans[0]) < t_tolerance && Math.abs(t_trans[1] - t_oldTrans[1]) < t_tolerance && Math.abs(t_scale - t_oldScale) < Number.EPSILON * 1000) {
      t_needToChange = false
    }
    if (!t_needToChange) { return 0 }
    this.zoom.zoomer.translate(t_trans).scale(t_scale)
    this.container
      .transition()
      .duration(duration)
      .attrTween('transform', () => {
        return d3.interpolate(t_oldTransform, t_newTransform)
      })
    if (t_scale > t_oldScale) {
      this.update(t_trans, t_scale, duration)
    } else {
      setTimeout(() => {
        this.update(t_trans, t_scale, duration)
      }, duration)
    }
    return duration
  } // end of toLevel
  prepareContainer (v_g) {
    let t_g = (this.container = v_g
      .call(this.zoom.zoomer)
      .on('dblclick.zoom', null)
      .append('g')
      .attr('class', 'SubMapTiling'))
    return t_g
  } // end of prepareContainer
} // end of class Visible

let initVisible = function (center, ringDiameter, glyphSize, clusterLevel, colors) {
  let t_duration = this.transition.duration
  return new Visible(this, center, ringDiameter, glyphSize, clusterLevel, colors)
}
