define([
  'exportClassFromAMD'
], function (ExportClass) {
  class Visible {
    constructor (parent, center, ringDiameter, glyphSize, clusterLevel, colors, duration) {
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
      this.roundView = false
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
      this.duration = duration
      this.container = null
      this.ctr = maxLevel / clusterLevel
      this.div = this.ctr * 0.5
      this.clsToScale = clusterLevel => { return Math.pow(Math.pow(2, clusterLevel * this.ctr), 0.25) }
    } // end of constructor of Visible

    // changeVisible:   change the visibility of an element
    changeVisible (selection, visibleFunc, givenOpacity = false) {
      selection.interrupt()
        .transition()
        .duration(this.duration)
        .attr('opacity', function (d, i) {
          let visible = visibleFunc(this)
          if (visible) {
            d3.select(this).classed('visible', true)
            if (givenOpacity) {
              return visible
            } else {
              return 1
            }
          } else {
            d3.select(this).classed('visible', false)
            return 0
          }
        })
    } // end of changeVisible

    pointVisible (position) {
      if (this.roundView) {
        let ringRRatio = this.parent.snapshotPar.ringRRatio
        position[0] = position[0] * this.scale - this.center[0] + this.translate[0]
        position[1] = position[1] * this.scale - this.center[1] + this.translate[1]
        let pr = Math.sqrt(position[0] * position[0] + position[1] * position[1])
        return (pr + this.glyphSize * this.scale <= this.diameter * ringRRatio - 8 * 0.9)
      } else {
        return true
      }
    } // end of pointVisible

    SubClsVisible (clsVisibility, zoomLevel) {
      let clsVisibleFunc = container => {
        let visible
        if (!d3.select(container).classed('Outliers')) {
          let clusterID = d3.select(container).attr('clsID').split('_')
          let baseline = (clusterID.length - 1) * this.ctr
          visible = zoomLevel >= baseline - this.div && zoomLevel < baseline + this.div
          clsVisibility[clusterID.length - 1].atLevel = visible
        } else {
          let baseline = (this.clsLevel - 1) * this.ctr
          visible = zoomLevel < baseline + this.div
        }
        return visible
      } // end of clsVisibleFunc
      let Cls = this.parent.d3el.selectAll('.SubMapClusters')
      let thisObject = this
      this.changeVisible(Cls, clsVisibleFunc)
      this.parent.d3el
        .selectAll('.visible .SubClsPath')
        .each(function (path) {
          let position = d3.select(this).attr('pos').split('_')
          let lineVisible = thisObject.pointVisible(position[0].split(',')) && thisObject.pointVisible(position[1].split(','))
          d3.select(this).attr('display', lineVisible ? 'block' : 'none')
        })
    } // end of SubClsVisible

    SubGlyphVisible (zoomLevel) {
      let glyphVisibleFunc = container => {
        let baseline = this.clsLevel * this.ctr
        if (zoomLevel >= baseline - this.div && zoomLevel < baseline + this.div) {
          let originalOpacity = this.parent.pattern ? parseFloat(d3.select(container).attr('ptOpacity')) : 1.0
          return ((this.div - Math.abs(zoomLevel - baseline)) / this.div * originalOpacity)
        } else {
          return false
        }
      } // end of glyphVisibleFunc
      let Cls = this.parent.d3el.selectAll('.dimFan')
      this.changeVisible(Cls, glyphVisibleFunc, true)
    } // end of SubGlyphVisible

    SubGridVisible (clsVisibility, scales) {
      let visible = new Set()
      let thisObject = this
      this.parent.d3el
        .selectAll('.SubMapGrids')
        .classed('visible', false)
        .classed('invisible', true)
        .interrupt()
        .transition()
        .duration(this.duration)
        .attr('opacity', 0)
      let transform = BasicView.getTransform(this.parent.d3el.select('.SubMapTiling').attr('transform'))
      let colors = this.parent.colors
      let gridFunc = function (grid) {
        let position = d3.select(this).attr('position').split('_')
        if (thisObject.pointVisible(position) && grid.id != null) {
          visible.add(grid.id)
          let globalPosition = Basic.scale(scales, grid.pos)
          let scale = transform.scale
          let trans = transform.translate
          if (transform.scaleFirst) {
            globalPosition[0] =
              globalPosition[0] * scale + trans[0]
            globalPosition[1] =
              globalPosition[1] * scale + trans[1]
          } else {
            globalPosition[0] =
              (globalPosition[0] + trans[0]) * scale
            globalPosition[1] =
              (globalPosition[1] + trans[1]) * scale
          }
          clsVisibility.update(grid.id, colors[grid.id], globalPosition)
        }
        return clsVisibility
      }
      let visibleContainers = this.parent.d3el
        .selectAll('.SubMapGrids')
        .filter(gridFunc)
        .attr('display', 'block')
        .classed('visible', true)
        .classed('invisible', false)
      visibleContainers
        .interrupt()
        .transition()
        .duration(this.duration)
        .attr('opacity', function () {
          let zgOpacity = parseFloat(d3.select(this).attr('zgOpacity'))
          let ftOpacity = parseFloat(d3.select(this).attr('ftOpacity'))
          let ptOpacity = parseFloat(d3.select(this).attr('ptOpacity'))
          zgOpacity = isNaN(zgOpacity) ? 1.0 : zgOpacity
          ftOpacity = isNaN(ftOpacity) ? 1.0 : ftOpacity
          ptOpacity = isNaN(ptOpacity) ? 1.0 : ptOpacity
          return zgOpacity * ftOpacity * ptOpacity
        })
      setTimeout(() => {
        this.parent.d3el
          .selectAll('.SubMapGrids.invisible')
          .attr('display', 'none')
      })
    } // end of SubGridVisible

    initializeVisible () {
      let clsVisibility = this.parent.currentCls.visible
      let clusterPaths = this.parent.currentCls.paths
      let parent = this.parent
      if (clsVisibility == null) {
        clsVisibility = this.parent.currentCls.visible = []
        clsVisibility.dictionary = new Map()
        let paths = this.parent.currentCls.paths
        for (let i = 0; i < paths.length; i++) {
          let zoomLevelPaths = paths[i]
          let zoomLevelVisible = []
          zoomLevelVisible.atLevel = false
          for (let j = 0; j < zoomLevelPaths.length; j++) {
            let outlier = zoomLevelPaths[j].outlier
            if (!outlier) {
              let ids = zoomLevelPaths[j].ids
              for (let k = 0; k < ids.length; k++) {
                zoomLevelVisible.push({
                  index: [j, k],
                  clsID: [...zoomLevelPaths[j].previous, k].join('_'),
                  visible: false,
                  positions: [],
                  colors: [],
                  avgPos: null,
                  avgCol: Basic.getMeanVector(Basic.subArray(this.colors, ids[k], [0, 1, 2]), false),
                  SShotAngle: 0
                })
              }
            }
          }
          clsVisibility.push(zoomLevelVisible)
        }
        clsVisibility.update = function (givenID, color, position) {
          let findFunc = d => {
            return d === givenID
          }
          for (let i = 0; i < this.length; i++) {
            if (!this[i].atLevel) {
              continue
            }
            let zoomLevelVisible = this[i]
            let dictionary = this.dictionary
            for (let j = 0; j < zoomLevelVisible.length; j++) {
              let visibleItem = zoomLevelVisible[j]
              let index = visibleItem.index
              let ids = clusterPaths[i][index[0]].ids[index[1]]
              let id = ids.findIndex(findFunc)
              if (id >= 0) {
                visibleItem.visible = true
                visibleItem.positions.push(position)
                visibleItem.colors.push(color)
                dictionary.set(givenID, [i, j])
                break
              }
            }
          }
        } // end of clsVisibility.update
        clsVisibility.updateColors = function (colorsMap) {
          let filterFunc = function () {
            let index = d3.select(this).attr('index')
            let returned = false
            if (colorsMap.has(index)) {
              returned = true
              let color = Basic.getMeanVector(colorsMap.get(index), false)
              color = BasicView.colToRgb(color)
            }
            return returned
          }
          parent.d3el.selectAll('.SubMapSShot').filter(filterFunc)
        } // end of clsVisibility.updateColors
      } else {
        clsVisibility.dictionary = new Map()
        for (let i = 0; i < clsVisibility.length; i++) {
          let zoomLevelVisible = clsVisibility[i]
          clsVisibility[i].atLevel = false
          for (let j = 0; j < zoomLevelVisible.length; j++) {
            let zoomLevelVisibleItem = zoomLevelVisible[j]
            zoomLevelVisibleItem.visible = false
            zoomLevelVisibleItem.avgPos = null
            zoomLevelVisibleItem.avgCol = null
            zoomLevelVisibleItem.sshotAngle = 0
          }
        }
      }
      return clsVisibility
    } // end of initializeVisible

    SubSnapshotVisible (clsVisibility) {
      let center = this.center
      let angleIntervel = 180 / this.parent.snapshotPar.angInterval
      for (let i = 0; i < clsVisibility.length; i++) {
        let zoomLevelVisible = clsVisibility[i]
        for (let j = 0; j < zoomLevelVisible.length; j++) {
          let zoomLevelVisibleItem = zoomLevelVisible[j]
          if (zoomLevelVisibleItem.positions.length > 0) {
            let averagePosition = (zoomLevelVisibleItem.avgPos = Basic.getMeanVector(zoomLevelVisibleItem.positions, false))
            let angle = Basic.getAngle(center, averagePosition)
            angle = Math.round(angle / Math.PI * angleIntervel) * Math.PI / angleIntervel
            zoomLevelVisibleItem.positions = []
            zoomLevelVisibleItem.SShotAngle = angle
          }
          if (zoomLevelVisibleItem.colors.length > 0) {
            zoomLevelVisibleItem.avgCol = Basic.getMeanVector(
              zoomLevelVisibleItem.colors,
              false
            )
            zoomLevelVisibleItem.colors = []
          }
        }
      }
    } // end of SubSnapshotVisible

    update (translate, scale, duration) {
      let zoomLevel = Math.log(Math.pow(scale, 4)) / Math.log(2)
      let clsVisibility = this.initializeVisible()
      this.scale = scale
      this.translate = translate
      this.SubClsVisible(clsVisibility, zoomLevel)
      this.SubGlyphVisible(zoomLevel)
      this.SubGridVisible(clsVisibility, this.parent.scales)
      this.SubSnapshotVisible(clsVisibility)
      this.parent.updateClusterInfo(false)
    } // end of update

    toLevel (center, zoomLevel, duration) {
      let scale = this.clsToScale(zoomLevel)
      let trans = [-center[0] * scale, -center[1] * scale]
      let newTransform = 'translate(' + trans + ')scale(' + scale + ')'
      let zoomer = this.zoom.zoomer
      let oldTrans = zoomer.translate()
      let oldScale = zoomer.scale()
      let oldTransform = 'translate(' + oldTrans + ')scale(' + oldScale + ')'
      let tolerance = this.parent.sizeTolr
      let needToChange = true
      if (Math.abs(trans[0] - oldTrans[0]) < tolerance && Math.abs(trans[1] - oldTrans[1]) < tolerance && Math.abs(scale - oldScale) < Number.EPSILON * 1000) {
        needToChange = false
      }
      if (!needToChange) { return 0 }
      this.zoom.zoomer.translate(trans).scale(scale)
      this.container
        .transition()
        .duration(this.duration)
        .attrTween('transform', () => {
          return d3.interpolate(oldTransform, newTransform)
        })
      if (scale > oldScale) {
        this.update(trans, scale, this.duration)
      } else {
        setTimeout(() => {
          this.update(trans, scale, this.duration)
        }, this.duration)
      }
      return this.duration
    } // end of toLevel

    prepareContainer (container) {
      let returned = (this.container = container
        .call(this.zoom.zoomer)
        .on('dblclick.zoom', null)
        .append('g')
        .attr('class', 'SubMapTiling'))
      return returned
    } // end of prepareContainer
  } // end of class Visible

  return ExportClass(Visible)
})
