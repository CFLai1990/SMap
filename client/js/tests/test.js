initVisible: function(center, ringDiameter, glyphSize, clusterLevel, colors) {
    class visibleObj {
        constructor(parent, center, ringDiameter, glyphSize, clusterLevel, colors) {
            let scaleExtent = [1, Math.sqrt(clusterLevel) + 1]
            let maxLevel = Math.log(Math.pow(scaleExtent[1], 4)) / Math.log(2)
            let zoomer = d3.behavior
                .zoom()
                .translate([0, 0])
                .scale(1)
                .scaleExtent(scaleExtent)
                .on('zoom', e => {
                    let translate = d3.event.translate
                    let scale = d3.event.scale
                    d3
                        .select('.SubMapTiling')
                        .attr(
                            'transform',
                            'translate(' + translate + ')scale(' + scale + ')'
                        )
                    this.update(translate, scale)
                })
            let ctr = maxLevel / clusterLevel
            this.center = center
            this.diameter = ringDiameter
            this.glyphSize = glyphSize
            this.clsLevel = clusterLevel
            this.colors = colors
            this.parent = parent
            this.zoom = {
                extent: scaleExtent,
                maxLevel: maxLevel,
                zoomer: zoomer
            }
            this.container = null
            this.ctr = ctr
            this.clsToScale = clusterLevel => { return Math.pow(Math.pow(2, clusterLevel * ctr), 0.25) }
        }
        update(v_trans, v_scale, duration = transDuration) {
            let level = Math.log(Math.pow(v_scale, 4)) / Math.log(2)
            let ctr = this.ctr
            let div = ctr * 0.5
            let parentOThis = this.parent
            let clsToScale = parentOThis.clsToScale
            let pathsOCls = parentOThis.currentCls.paths
            let scales = parentOThis.scales
            let ringRRatio = parentOThis.snapshotPar.ringRRatio
            let transform = BasicView.getTransform(parentOThis.d3el.select('.SubMapTiling').attr('transform'))
            let pointVisible = position => {
                position[0] = position[0] * v_scale - this.center[0] + v_trans[0]
                position[1] = position[1] * v_scale - this.center[1] + v_trans[1]
                let pr = Math.sqrt(position[0] * position[0] + position[1] * position[1])
                return (pr + this.glyphSize * v_scale <= this.diameter * ringRRatio - 8 * 0.9)
            }
            let t_changeVisible = (v_selection, v_visibleFunc, v_givenOpc = false) => {
                v_selection
                    .interrupt()
                    .transition()
                    .duration(duration)
                    .attr('opacity', function(v_d, v_i) {
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
            }
            let t_SubClsVisible = v_baseLineFunc => {
                let t_clsVisibleFunc = v_gCls => {
                    let t_visible
                    if (!d3.select(v_gCls).classed('Outliers')) {
                        let t_clsID = d3
                            .select(v_gCls)
                            .attr('clsID')
                            .split('_'),
                            t_baseline = (t_clsID.length - 1) * ctr
                        t_visible =
                            level >= t_baseline - div &&
                            level < t_baseline + div
                        t_clsVisible[t_clsID.length - 1].atLevel = t_visible
                    } else {
                        let t_baseline = (this.clsLevel - 1) * ctr
                        t_visible = level < t_baseline + div
                    }
                    return t_visible
                }
                let t_Cls = parentOThis.d3el.selectAll('.SubMapClusters')
                t_changeVisible(t_Cls, t_clsVisibleFunc)
                parentOThis.d3el
                    .selectAll('.visible .SubClsPath')
                    .each(function(v_path) {
                        let tempPosition = d3
                            .select(this)
                            .attr('pos')
                            .split('_'),
                            t_lineVisible =
                            pointVisible(tempPosition[0].split(',')) &&
                            pointVisible(tempPosition[1].split(','))
                        d3
                            .select(this)
                            .attr('display', t_lineVisible ? 'block' : 'none')
                    })
            }
            let t_SubGlyphVisible = () => {
                let t_glyphVisibleFunc = v_gCls => {
                    let t_baseline = this.clsLevel * ctr
                    if (
                        level >= t_baseline - div &&
                        level < t_baseline + div
                    ) {
                        let t_originOpc = parentOThis.pattern ?
                            parseFloat(d3.select(v_gCls).attr('ptOpacity')) :
                            1.0
                        return (
                            (div - Math.abs(level - t_baseline)) /
                            div *
                            t_originOpc
                        )
                    } else {
                        return false
                    }
                }
                let t_Cls = parentOThis.d3el.selectAll('.dimFan')
                t_changeVisible(t_Cls, t_glyphVisibleFunc, true)
            }
            let t_SubGridVisible = () => {
                let t_visible = new Set(),
                    invisible = false
                parentOThis.d3el
                    .selectAll('.SubMapGrids')
                    .classed('visible', false)
                    .classed('invisible', true)
                    .interrupt()
                    .transition()
                    .duration(duration)
                    .attr('opacity', 0)
                let t_dictionary = t_clsVisible.dictionary,
                    t_visible_gs = parentOThis.d3el
                    .selectAll('.SubMapGrids')
                    .filter(function(v_grid) {
                        let tempPosition = d3
                            .select(this)
                            .attr('position')
                            .split('_'),
                            t_isVisible = pointVisible(tempPosition),
                            t_id = v_grid.id
                        if (t_isVisible && t_id != null) {
                            t_visible.add(t_id)
                            let t_glbPos = Basic.scale(scales, v_grid.pos),
                                tt_scale = transform.scale,
                                tt_trans = transform.translate
                            if (transform.scaleFirst) {
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
                                parentOThis.colors[v_grid.id],
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
                    .attr('opacity', function() {
                        let parentOThis = d3.select(this),
                            t_zgOpc = parseFloat(parentOThis.attr('zgOpacity')),
                            t_ftOpc = parseFloat(parentOThis.attr('ftOpacity')),
                            t_ptOpc = parseFloat(parentOThis.attr('ptOpacity'))
                        t_zgOpc = isNaN(t_zgOpc) ? 1.0 : t_zgOpc
                        t_ftOpc = isNaN(t_ftOpc) ? 1.0 : t_ftOpc
                        t_ptOpc = isNaN(t_ptOpc) ? 1.0 : t_ptOpc
                        return t_zgOpc * t_ftOpc * t_ptOpc
                    })
                setTimeout(() => {
                    parentOThis.d3el
                        .selectAll('.SubMapGrids.invisible')
                        .attr('display', 'none')
                })
            }
            let t_SubSnapshotVisible = (v_init) => {
                let t_clsVisible = parentOThis.currentCls.visible
                if (v_init) {
                    if (t_clsVisible == null) {
                        t_clsVisible = parentOThis.currentCls.visible = new Array()
                        t_clsVisible.dictionary = new Map()
                        let t_paths = parentOThis.currentCls.paths
                        for (let i = 0; i < t_paths.length; i++) {
                            let levelPaths = t_paths[i],
                                levelVisible = new Array()
                            levelVisible.atLevel = false
                            for (let j = 0; j < levelPaths.length; j++) {
                                let t_outlier = levelPaths[j].outlier
                                if (!t_outlier) {
                                    let t_ids = levelPaths[j].ids
                                    for (let k = 0; k < t_ids.length; k++) {
                                        levelVisible.push({
                                            index: [j, k],
                                            clsID: [...levelPaths[j].previous, k].join('_'),
                                            visible: false,
                                            positions: new Array(),
                                            colors: new Array(),
                                            avgPos: null,
                                            avgCol: Basic.getMeanVector(Basic.subArray(this.colors, t_ids[k], [0, 1, 2]), false),
                                            SShotAngle: 0
                                        })
                                    }
                                }
                            }
                            t_clsVisible.push(levelVisible)
                        }
                        t_clsVisible.update = function(v_id, v_col, position) {
                            let t_findFunc = v_d => {
                                return v_d == v_id
                            }
                            for (let i = 0; i < this.length; i++) {
                                if (!this[i].atLevel) {
                                    continue
                                }
                                let levelVisible = this[i],
                                    t_found = false,
                                    t_foundPath = new Array(),
                                    t_dictionary = this.dictionary
                                for (let j = 0; j < levelVisible.length; j++) {
                                    let t_visibleItem = levelVisible[j],
                                        t_index = t_visibleItem.index,
                                        t_ids =
                                        pathsOCls[i][t_index[0]].ids[t_index[1]],
                                        t_id = t_ids.findIndex(t_findFunc)
                                    if (t_id >= 0) {
                                        t_visibleItem.visible = true
                                        t_visibleItem.positions.push(position)
                                        t_visibleItem.colors.push(v_col)
                                        t_dictionary.set(v_id, [i, j])
                                        break
                                    }
                                }
                            }
                        }
                        t_clsVisible.updateColors = function(colorsMap) {
                            let transDuration = parentOThis.transition.short
                            parentOThis.d3el
                                .selectAll('.SubMapSShot')
                                .filter(function() {
                                    let t_index = d3.select(this).attr('index'),
                                        t_return = false
                                    if (colorsMap.has(t_index)) {
                                        t_return = true
                                        let t_col = Basic.getMeanVector(
                                            colorsMap.get(t_index),
                                            false
                                        )
                                        t_col = BasicView.colToRgb(t_col)
                                    }
                                    return t_return
                                })
                        }
                    } else {
                        t_clsVisible.dictionary = new Map()
                        for (let i = 0; i < t_clsVisible.length; i++) {
                            let levelVisible = t_clsVisible[i]
                            t_clsVisible[i].atLevel = false
                            for (let j = 0; j < levelVisible.length; j++) {
                                let levelVisibleItem = levelVisible[j]
                                levelVisibleItem.visible = false
                                levelVisibleItem.avgPos = null
                                levelVisibleItem.avgCol = null
                                levelVisibleItem.sshotAngle = 0
                            }
                        }
                    }
                } else {
                    let t_center = this.center,
                        t_angles = new Array(),
                        t_PI = Math.PI,
                        t_angInterval = 180 / parentOThis.snapshotPar.angInterval
                    for (let i = 0; i < t_clsVisible.length; i++) {
                        let levelVisible = t_clsVisible[i]
                        for (let j = 0; j < levelVisible.length; j++) {
                            let levelVisibleItem = levelVisible[j]
                            if (levelVisibleItem.positions.length > 0) {
                                let t_avgPos = (levelVisibleItem.avgPos = Basic.getMeanVector(
                                        levelVisibleItem.positions,
                                        false
                                    )),
                                    t_angle = Basic.getAngle(t_center, t_avgPos)
                                t_angle =
                                    Math.round(t_angle / t_PI * t_angInterval) *
                                    t_PI /
                                    t_angInterval
                                levelVisibleItem.positions = new Array()
                                levelVisibleItem.SShotAngle = t_angle
                            }
                            if (levelVisibleItem.colors.length > 0) {
                                levelVisibleItem.avgCol = Basic.getMeanVector(
                                    levelVisibleItem.colors,
                                    false
                                )
                                levelVisibleItem.colors = new Array()
                            }
                        }
                    }
                }
                return t_clsVisible
            }
            let t_clsVisible = t_SubSnapshotVisible(true)
            t_SubClsVisible()
            t_SubGlyphVisible()
            t_SubGridVisible()
            t_SubSnapshotVisible()
            parentOThis.updateClusterInfo(false)
        }
        toLevel(center, v_level, duration) {
            let t_scale = this.clsToScale(v_level),
                t_trans = [-center[0] * t_scale, -center[1] * t_scale],
                t_newTransform =
                'translate(' + t_trans + ')scale(' + t_scale + ')',
                zoomer = this.zoom.zoomer,
                t_oldTrans = zoomer.translate(),
                t_oldScale = zoomer.scale(),
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
        }
        prepareContainer(v_g) {
            let t_g = (this.container = v_g
                .call(this.zoom.zoomer)
                .on('dblclick.zoom', null)
                .append('g')
                .attr('class', 'SubMapTiling'))
            return t_g
        }
    }
    let transDuration = this.transition.duration
    return new visibleObj(this, center, ringDiameter, glyphSize, clusterLevel, colors)
},