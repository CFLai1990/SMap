define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'jqueryui',
    'hexbin',
    'voronoi',
    'backbone',
    'datacenter',
    'config',
    'Base',
    'Tiling',
    'SubRotate',
    'SubGlyph',
    'SubMap_ModelView',
    ], function(require, Mn, _, $, JQueryUI, HexBin, Voronoi, Backbone, Datacenter, Config, Base, Tile, Subrotate, Subglyph, SubMap_ModelView) {
        'use strict';
        String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        }

        var SubMap_CollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            attributes: {
                "id":"SubMap",
            },

            childView: SubMap_ModelView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            initialize: function (options) {
                var self = this;
                var t_width = parseFloat($("#SubMap_CollectionViewSVG").css("width")),
                t_height = parseFloat($("#SubMap_CollectionViewSVG").css("height")),
                t_size = Math.min(t_width, t_height);
                var t_left = (t_width - t_size) / 2 + t_size * 0.15, t_top = (t_height - t_size) / 2 + t_size * 0.15
                var t_defaults = {
                    parameter: {
                        size: t_size,
                        scales: {
                            x: d3.scale.linear().range([t_left, t_left + t_size * 0.7]).domain([0,1]),
                            y: d3.scale.linear().range([t_top, t_top + t_size * 0.7]).domain([0,1]),
                        },
                        r: 2,
                        dimCover: [],
                        distMat: null,
                        diffMat: null,
                        distExt: null,
                        nghList: null,
                        zoomed: false,
                        pattern: false,
                        aggregate: null,
                        nghDims: null,
                        freeDim: null,
                        fCodes: null,
                        fMatrix: null,
                        colors: null,
                        colorFixed: false,
                    },
                };
                options = options || {};
                _.extend(this, options);
                _.extend(this, t_defaults);
                this.layout = Config.get("childviewLayout");
                this.bindAll();
            },

            onShow: function(){
                var self = this;
            },

            bindAll: function(){
                this.listenTo(this.collection, "SubMapCollection__ShowMap", this.showMap);
                this.listenTo(this.collection, "SubMapCollection__ShowModels", this.showModels);
                this.listenTo(Config, "change:gridNumber", this.showMap);
                this.bindZooming();
                this.bindTuning();
            },

            showMap: function(){
                this.clearAll();
                this.clearCanvas();
                // this.showProjection();
                // this.showGrids();
                this.filtering();
                this.showTiling();
                this.showRing();
            },

            filtering: function(){
                let t_dimCover = this.zoomed?this.dimCover:null;
                this.fCodes = this.filterCodes(this.collection.subIndex, t_dimCover);
                this.fMatrix = this.filterMatrix(this.collection.subIndex, this.fCodes.dataIndeces);
            },

            filterCodes: function(v_codes, v_dimCover){
                let t_empty = true, t_dimIndeces;
                if(v_dimCover != null){
                    for(let i = 0; i < v_dimCover.length; i++){
                        if(!t_empty){
                            continue;
                        }
                        if(v_dimCover[i] >= 0){
                            t_empty = false;
                        }
                    }
                }
                if(t_empty){
                    t_dimIndeces = new Array(v_codes[0].length);
                    for(let i = 0; i < t_dimIndeces.length; i++){
                        t_dimIndeces[i] = i;
                    }
                    return {
                        codes: v_codes,
                        dataIndeces: null,
                        dimIndeces: t_dimIndeces,
                    };
                }else{
                    t_dimIndeces = [];
                    let t_arr = new Array(),
                        t_indeces = new Array(),
                        t_dims = v_dimCover,
                        t_changed = false;
                    for(let i = 0; i < v_codes.length; i++){
                        let t_code = v_codes[i], t_fit = true;
                        for(let j = 0; j < t_dims.length; j++){
                            let t_dim = t_dims[j];
                            if(t_dim < 0 || !t_fit){
                                continue;
                            }else{
                                if(t_code[j] != t_dim){
                                    t_fit = false;
                                }
                            }
                        }
                        if(t_fit){
                            t_indeces.push(i);
                            let t_newCode = [];
                            for(let j = 0; j < t_dims.length; j++){
                                let t_dim = t_dims[j];
                                if(t_dim < 0){
                                    if(!t_changed){
                                        t_dimIndeces[t_newCode.length] = j;
                                    }
                                    t_newCode.push(t_code[j]);
                                }
                            }
                            if(!t_changed){
                                t_changed = true;
                            }
                            t_arr.push(t_newCode);
                        }
                    }
                    return {
                        codes: t_arr,
                        dataIndeces: t_indeces,
                        dimIndeces: t_dimIndeces,
                    };
                }
            },

            filterMatrix: function(v_codeBook, v_indeces){
                let t_dataLength = v_codeBook.length;
                if(!this.distMat){
                    this.distMat = this.collection.dataDist;
                }
                if(!this.diffMat){
                    let t_diffMat = Basic.initArray(t_dataLength, t_dataLength);
                    for(let i = 0; i < t_diffMat.length - 1; i++){
                        for(let j = i + 1; j < t_diffMat[i].length; j++){
                            let tt_code_i = v_codeBook[i],
                                tt_code_j = v_codeBook[j],
                                t_dist = 0;
                            for(let k = 0; k < tt_code_i.length; k++){
                                if(tt_code_i[k] != tt_code_j[k]){
                                    t_dist++;
                                }
                            }
                            t_diffMat[i][j] = t_diffMat[j][i] = t_dist;
                        }
                    }
                    this.diffMat = t_diffMat;
                }
                if(!this.nghList){
                    this.nghList = Basic.KNNGByDistMat(this.distMat, Config.get("SUB_K"));
                }
                if(!this.distExt){
                    this.distExt = Basic.extArray(this.distMat);
                }
                if(!this.colors){
                    this.colors = this.collection.colors;
                }
                if(v_indeces == null){
                    return {
                        neighbors: this.nghList,
                        distMat: this.distMat,
                        diffMat: this.diffMat,
                        distExt: this.distExt,
                        colors: this.colors,
                    };
                }else{
                    let t_distMat = Basic.subArray(this.distMat, v_indeces, v_indeces),
                        t_diffMat = Basic.subArray(this.diffMat, v_indeces, v_indeces),
                        t_nghList = Basic.KNNGByDistMat(t_distMat, Config.get("SUB_K")),
                        t_distExt = Basic.extArray(t_distMat);
                    return {
                        neighbors: t_nghList,
                        distMat: t_distMat,
                        diffMat: t_diffMat,
                        distExt: t_distExt,
                        colors: null,
                    };
                }
            },

            zoomingVisible: function(v_center, v_D, v_r, v_trans, v_scale, v_colors){
                let t_visible = new Set(), unvisible = false;
                this.d3el.selectAll(".SubMapGrids")
                .classed("visible", false)
                .transition()
                .style("visibility", "hidden");
                let t_visible_gs = 
                this.d3el.selectAll(".SubMapGrids")
                .filter(function(v_grid){
                    let t_pos = d3.select(this).attr("position").split("_");
                    t_pos[0] = t_pos[0] * v_scale - v_center[0] + v_trans[0];
                    t_pos[1] = t_pos[1] * v_scale - v_center[1] + v_trans[1];
                    let t_pr = Math.sqrt(t_pos[0] * t_pos[0] + t_pos[1] * t_pos[1]);
                    if(t_pr + v_r * v_scale <= v_D * 0.55 - 8 * 0.9){
                        if(v_grid.id != null){
                            t_visible.add(v_grid.id);
                        }
                        return true;
                    }else{
                        if(v_grid.id != null){
                            unvisible = true;
                        }
                        return false;
                    }
                })
                .classed("visible", true);
                t_visible_gs
                .interrupt()
                .transition()
                .style("visibility", "visible");
                if(unvisible){
                    let t_changeColor = () => {
                        t_visible = Basic.mapToArray(t_visible);
                        let t_colors = Basic.scaleArray(Basic.subArray(v_colors, t_visible, [0,1,2]));
                        t_visible_gs
                        .selectAll(".metaGlyph.cell.fill")
                        .filter(function(){return !d3.select($(this).parent()[0]).classed("empty")})
                        .transition()
                        .attr("fill", (v_grid) => {
                            if(v_grid.id == null){
                                return;
                            }
                            let t_id = t_visible.indexOf(v_grid.id), t_col = t_colors[t_id];
                            t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                            t_col = "rgb(" + t_col + ")";
                            return t_col;
                        });
                    }
                    Basic.delay("changeColor", 400, t_changeColor);
                }else{                    
                    let t_changeColor = () => {
                        t_visible_gs
                        .selectAll(".metaGlyph.cell.fill")
                        .filter(function(){return !d3.select($(this).parent()[0]).classed("empty")})
                        .transition()
                        .attr("fill", (v_grid) => {
                            if(v_grid.id == null){
                                return;
                            }
                            let t_col = v_colors[v_grid.id];
                            t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                            t_col = "rgb(" + t_col + ")";
                            return t_col;
                        });
                    }
                    Basic.delay("changeColor", 400, t_changeColor);
                }
            },

            showTiling: function(){
                let t_filterCodes = this.fCodes,
                    t_codes = t_filterCodes.codes,
                    t_indeces = t_filterCodes.dataIndeces,
                    t_dataLength = t_codes.length,
                    t_codeLength = t_codes[0].length;
                let t_filterMat = this.fMatrix,
                    t_nghList = t_filterMat.neighbors,
                    t_distMat = t_filterMat.distMat,
                    t_diffMat = t_filterMat.diffMat,
                    t_distExt = t_filterMat.distExt,
                    t_colors = t_filterMat.colors,
                    t_aggrRange = this.aggregateCodes(t_codes, t_nghList);
                let t_aggrScale = d3.scale.linear().domain(t_aggrRange).range([0,1]);
                let t_grids = Tiling.getMap(t_nghList, t_distMat, t_codes, Config.get("gridType"), Config.get("gridScaling"));
                if(typeof(t_grids) === "string"){
                    //failed
                    throw "ERROR: " + t_grids;
                    return;
                }                
                if(!this.freeDim){
                    this.freeDim = t_codeLength;
                }
                let t_df = $.Deferred();
                if(this.zoomed){
                    this.collection.getColors(t_df, t_distMat);
                }else{
                    t_df.resolve(t_colors);
                }
                $.when(t_df).done(vv_colors => {
                    let t_centerID = t_grids.getCenterPID(),
                        t_colorScale = d3.scale.linear().domain([0,1]).range([45, 315]);//hue channel
                    if(this.zoomed){
                        // let t_subColors = Basic.subArray(this.colors, t_indeces, [0,1,2]);
                        // t_colors = SubRotate.groupMoveTo(vv_colors, t_subColors);//rgb color;
                        t_colors = this.colors;
                    }else{
                        if(!this.colorFixed){
                            this.colors = SubRotate.pointMoveTo(vv_colors, t_centerID, Config.get("centerColor"));//rgb color;
                            this.colorFixed = true;
                        }
                        t_colors = this.colors;
                    }
                    let t_scales = this.parameter.scales,
                        t_center = [(t_scales.x.range()[1] + t_scales.x.range()[0]) * 0.5,
                                (t_scales.y.range()[1] + t_scales.y.range()[0]) * 0.5],
                        t_dRing = [(t_scales.x.range()[1] - t_scales.x.range()[0]),
                                (t_scales.y.range()[1] - t_scales.y.range()[0])],
                        t_rSize =  t_dRing[0] * 0.5 / t_grids.radius,
                        t_r = this.parameter.r;
                    let t_zoom = d3.behavior.zoom()
                        .translate([0, 0])
                        .scale(1)
                        .scaleExtent([1, Math.floor(Math.sqrt(this.freeDim * 2))])
                        .on("zoom", (e) => {
                            let t_trans = d3.event.translate,
                                t_scale = d3.event.scale;
                            d3.select(".SubMapTiling")
                            .attr("transform", "translate(" + t_trans + ")scale(" + t_scale + ")");
                            this.zoomingVisible(t_center, t_dRing[0], t_rSize, t_trans, t_scale, t_colors);
                        });
                    let t_nghDims = this.nghDims, t_ext = t_nghDims.extent,
                        t_nghScale = d3.scale.linear().domain([t_distExt.min, t_distExt.max]).range([0, 0.8]),
                        t_diffScale = d3.scale.linear().domain([1, t_codeLength]).range([0, t_rSize * Math.sqrt(3) * 2 / 3]),
                        t_renderEmpty = new Set(), t_renderGrids = new Set(), t_this = this,
                        t_g = this.d3el
                        .call(t_zoom)
                        .append("g")
                        .attr("class","SubMapTiling")
                        .selectAll(".SubMapGridRows")
                        .data(t_grids)
                        .enter()
                        .append("g")
                        .attr("class", "SubMapGridRows")
                        .selectAll("SubMapGrids")
                        .data(v_d => {return v_d;})
                        .enter()
                        .append("g")
                        .attr("class", "SubMapGrids")
                        .classed("empty", v_grid => {
                            return (v_grid.id==null)?true:false;
                        })
                        .attr("position", v_grid => {
                            let t_pos = Basic.scale(t_scales, v_grid.pos);
                            return t_pos.join("_");
                        })
                        .attr("transform", v_grid => {
                            return "translate(" + Basic.scale(t_scales, v_grid.pos) + ")";
                        });
                        // .attr("fill-opacity", v_grid => {
                        //     if(v_grid.id == null){
                        //         return;
                        //     }
                        //     let t_code = v_grid.code.join(""),
                        //         t_count = this.aggregate.get(t_code);
                        //     console.log(t_code, t_count, t_aggrScale(t_count));
                        //     return t_aggrScale(t_count);
                        // });
                    SubGlyph.init(t_rSize, t_rSize, Config.get("mapType"), Config.get("glyphType"), t_colors);
                    t_g.call(function(v_gs){
                        v_gs.forEach(vv_gs => {
                            vv_gs.forEach(vvv_gs => {
                                let tt_grid = d3.select(vvv_gs).data()[0], t_pid = tt_grid.id, t_col, t_code = tt_grid.code;
                                if(t_pid != null){
                                    // t_col = d3.hsl(t_colorScale(t_colors[t_pid][2]), 1.0, 0.4).toString();
                                    t_col = t_colors[t_pid];
                                    t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                                    t_col = "rgb(" + t_col + ")";
                                }else{
                                    t_col = "#fff";
                                }
                                let tt_nghIDs, t_sPos = tt_grid.pos, tt_div;
                                switch(Config.get("gridType")){
                                    case "hexagon":
                                        tt_div = Math.PI * 2 / 6;
                                        tt_nghIDs = new Array(6);
                                        for(let i = 0; i < 6; i++){
                                            tt_nghIDs[i] = {
                                                angle: tt_div * i,
                                                diff: null,
                                                dist: null,
                                            };
                                        }
                                        tt_nghIDs.diffScale = t_diffScale;
                                    break;
                                }
                                if(t_pid!=null){
                                    tt_grid.gridNeighbors.forEach(v_ngh => {
                                        let t_ngh = t_grids[v_ngh[0]][v_ngh[1]],
                                            tt_id = t_ngh.id,
                                            tt_dist, tt_diff,
                                            t_nPos = t_ngh.pos,
                                            t_divPos = [t_nPos[0] - t_sPos[0], t_nPos[1] - t_sPos[1]],
                                            t_angle;
                                        if(tt_id!=null){
                                            tt_dist = t_distMat[t_pid][tt_id];
                                            tt_diff = t_diffMat[t_pid][tt_id];
                                            if(Math.abs(t_divPos[0]) < Number.EPSILON){
                                                if(t_nPos[1] > t_sPos[1]){
                                                    t_angle = Math.PI / 2;
                                                }else{
                                                    t_angle = - Math.PI / 2;
                                                }
                                            }else{
                                                let t_tan = t_divPos[1]/t_divPos[0];
                                                t_angle = Math.atan(t_tan);
                                                if(t_tan < 0){
                                                    if(t_divPos[1] > 0){
                                                        t_angle += Math.PI;
                                                    }else{
                                                        t_angle += Math.PI * 2;
                                                    }
                                                }else{
                                                    if(t_tan > 0){
                                                        if(t_divPos[1] < 0){
                                                            t_angle += Math.PI;
                                                        }
                                                    }else{
                                                        if(t_tan == 0){
                                                            if(t_divPos[0] > 0){
                                                                t_angle = 0;
                                                            }else{
                                                                t_angle = Math.PI;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            let t_number = Math.round(t_angle / tt_div);
                                            tt_nghIDs[t_number].dist = t_nghScale(tt_dist);
                                            tt_nghIDs[t_number].diff = tt_diff;
                                        }
                                    });
                                }
                                let t_weights = (t_pid == null)?null:t_nghDims[t_pid],
                                    t_parameters = [d3.select(vvv_gs), tt_nghIDs, t_pid, t_codes[t_pid], t_col, this.pattern, t_weights, t_ext];
                                if(t_pid == null){
                                    t_renderEmpty.add(t_parameters);
                                }else{
                                    t_renderGrids.add(t_parameters);
                                }
                            });
                        });
                    });
                    t_renderEmpty.forEach(v_emptyPmt => {
                        let t_g = SubGlyph.showGlyph(...v_emptyPmt);
                    });
                    t_renderGrids.forEach(v_gridPmt => {
                        let t_g = SubGlyph.showGlyph(...v_gridPmt);
                        t_g.on("click", function(v_point){
                            d3.selectAll(".SubMapGrids").classed("selected", false);
                            if(v_point.id == null){
                                return;
                            }
                            d3.select(this).classed("selected", true);
                            t_this.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__ShowProjection", data: v_point.code});
                        })
                        // t_g
                        // .on("mouseover", function(v_point){
                        //     if(d3.select(this).classed("center")){
                        //         return;
                        //     }
                        //     let t_id = v_point.id, t_nghs = new Set(v_point.dataNeighbors);
                        //     d3.selectAll(".SubMapGrids")
                        //     .filter(vv_point => {
                        //         return vv_point.id != null;
                        //     })
                        //     .transition()
                        //     .attr("opacity", 0.2);
                        //     d3.select(this)
                        //     .classed("center", true);
                        //     d3.selectAll(".SubMapGrids")
                        //     .filter(vv_point => {
                        //         return vv_point.id != null && (t_nghs.has(vv_point.id) || vv_point.id == t_id);
                        //     })
                        //     .interrupt()
                        //     .transition()
                        //     .attr("opacity", 1);
                        // })
                        // .on("mouseout", function(v_point){
                        //     d3.selectAll(".SubMapGrids")
                        //     .filter(vv_point => {
                        //         return vv_point.id != null;
                        //     })
                        //     .classed("center",false)
                        //     .interrupt()
                        //     .transition()
                        //     .attr("opacity", 1);
                        // });
                    });
                });                
            },

            showRing: function(){
                let t_codes = this.fCodes.codes,
                    t_dataInd = this.fCodes.dataIndeces,
                    t_dimInd = this.fCodes.dimIndeces,
                    t_dataLength = t_codes.length,
                    t_dimLength = t_codes[0].length,
                    t_angles = new Array(t_dimLength),
                    t_angCount = new Array(t_dimLength),
                    t_divRatio = 0.4,
                    t_divAngle = Math.PI * 2 / t_dimLength * t_divRatio;
                    t_angles.fill(0);
                    t_angCount.fill(0);
                for(let i = 0; i < t_dimLength; i++){
                    t_angles[i] = 360 / t_dimLength * i;
                }
                let t_scales = this.parameter.scales,
                    t_r = (t_scales.x.range()[1] - t_scales.x.range()[0]) * 0.55,
                    t_radius = 8,
                    t_radScale = 1.3,
                    t_radAngle = Math.asin(t_radius * t_radScale / 2 / t_r) * 2,
                    t_arcR = [t_r - t_radius * 0.9, t_r + t_radius * 0.9],
                    t_arcAngle = (t_divAngle - t_radAngle) * 0.95,
                    t_this = this,
                    t_setArc = function(v_portion, v_radius, v_divAngle){
                        let t_startAngle = - v_divAngle,
                            t_endAngle = (-1 + v_portion * 2) * v_divAngle,
                            t_arc = d3.svg.arc()
                            .innerRadius(v_radius[0])
                            .outerRadius(v_radius[1])
                            .startAngle(t_startAngle)
                            .endAngle(t_endAngle);
                        return t_arc();
                    },
                    t_updateBars = function(v_indeces){
                        let t_allLength = t_dataLength,
                            t_subLength,
                            t_indeces = v_indeces;
                        if(t_indeces == null){
                            t_indeces = new Array(t_allLength);
                            for(let i = 0; i < t_allLength; i++){
                                if(t_dataInd == null){
                                    t_indeces[i] = i;
                                }else{
                                    t_indeces[i] = t_dataInd[i];
                                }
                            }
                        }else{
                            t_subLength = v_indeces.length;
                            if(t_subLength == 0){
                                t_subLength = 1;
                            }
                        }
                        let t_coverage = t_this.collection.getCoverage(t_indeces);
                        t_this.d3el.selectAll(".SubMapDim")
                        .forEach(v_gs => {
                            v_gs.forEach(v_g => {
                                let t_g = d3.select(v_g),
                                    t_dim = t_g.attr("dimID"),
                                    t_portion = t_coverage[t_dim] / (t_subLength == null?t_allLength:t_subLength),
                                    // t_portion = t_coverage[t_dim] / t_allLength,
                                    t_bar = t_g.selectAll(".bar");
                                if(t_bar.empty()){
                                    t_g
                                    .selectAll(".bar")
                                    .data([t_portion])
                                    .enter()
                                    .append("path")
                                    .attr("class", "bar")
                                    .attr("d", v_portion => {
                                        return t_setArc(v_portion, t_arcR, t_arcAngle)
                                    });
                                }else{
                                    let t_data = t_g.selectAll(".bar").data()[0];
                                    t_g
                                    .selectAll(".bar")
                                    .data([t_portion])
                                    .transition()
                                    .attrTween("d", v_portion => {
                                        let t_inter = d3.interpolate(t_data, v_portion),
                                            tween = function(t){
                                            let t_interData = t_inter(t);
                                            return t_setArc(t_interData, t_arcR, t_arcAngle);
                                        };
                                        return tween;
                                    });
                                }
                            })
                        });
                    },
                    t_setDim = function(v_g, v_radius, v_i, v_dim, v_sign){
                        let t_gs = d3.selectAll(".SubMapGrids"), t_dimCover = new Array(t_dimInd.length);
                        if(v_i != null){
                            let t_parent = $(v_g).parent()[0],
                            t_index = t_dimInd[v_i];
                            d3.select(t_parent)
                            .classed("active", v_sign);
                            d3.select(t_parent)
                            .selectAll("circle.active")
                            .transition()
                            .attr("r", v_radius);
                            d3.select(t_parent)
                            .selectAll("circle")
                            .classed("active", false);
                            if(v_sign){
                                d3.select(v_g)
                                .classed("active", true)
                                .transition()
                                .attr("r", v_radius * t_radScale);
                            }
                            t_this.dimCover[t_index] = v_dim;
                        }else{
                            v_g.filter(function(v_angle, v_i){
                                let tt_index = t_dimInd[v_i],
                                    t_cover = t_this.dimCover[tt_index];
                                if(t_cover >= 0){
                                    let t_class = t_cover == 1?".On":".Off";
                                    d3.select(this)
                                    .select(t_class)
                                    .classed("active", true);
                                    return true;
                                }else{
                                    return false;
                                }
                            })
                            .classed("active", true)
                            .selectAll(".active")
                            .transition()
                            .attr("r", v_radius * t_radScale);
                        }
                        for(let i = 0; i < t_dimInd.length; i++){
                            t_dimCover[i] = t_this.dimCover[t_dimInd[i]];
                        }
                        SubGlyph.filterGlyphs(t_gs, null, false);
                        return SubGlyph.filterGlyphs(t_gs, t_dimCover, true);
                    },
                    t_g = this.d3el
                    .append("g")
                    .attr("class", "SubMapRings")
                    .attr("transform", "translate(" + Basic.scale(t_scales, [0.5, 0.5]) + ")")
                    .selectAll(".SubMapDim")
                    .data(t_angles)
                    .enter()
                    .append("g")
                    .attr("class", "SubMapDim")
                    .attr("dimID", (v_angle, v_i) => {return t_dimInd[v_i];})
                    .attr("transform", (v_angle, v_i) => {
                        return "rotate(" + v_angle + ")";
                    });
                t_g.append("text")
                .attr("x", (v_angle, v_i) => {
                    let t_text = this.collection.dimensions[t_dimInd[v_i]];
                    return -t_text.visualLength()[0] / 2;
                })
                .attr("y", (v_angle, v_i) => {
                    let t_text = this.collection.dimensions[t_dimInd[v_i]],
                        t_rotate = v_angle >= 90 && v_angle < 270;
                    return (t_r + t_radius + 10) * (t_rotate?1:-1)
                            + (t_rotate?(t_text.visualLength()[1]/2):0);
                })
                .attr("transform", (v_angle, v_i) => {
                    return "rotate(" + ((v_angle >= 90 && v_angle < 270)?180:0) + ")";
                })
                .text((v_angle, v_i) => {
                    return this.collection.dimensions[t_dimInd[v_i]];
                });
                t_g.append("circle")
                .classed("On", true)
                .attr("cx", t_r * Math.sin(-t_divAngle + Math.PI))
                .attr("cy", t_r * Math.cos(-t_divAngle + Math.PI))
                .attr("r", t_radius)
                .on("click", function(v_angle, v_i){
                    let t_active = d3.select(this).classed("active"),
                        t_indeces;
                    if(!t_active){
                        t_indeces = t_setDim(this, t_radius, v_i, 1, !t_active);
                    }else{
                        t_indeces = t_setDim(this, t_radius, v_i, -1, !t_active);
                    }
                    t_updateBars(t_indeces);
                });
                t_g.append("circle")
                .classed("Off", true)
                .attr("cx", t_r * Math.sin(t_divAngle + Math.PI))
                .attr("cy", t_r * Math.cos(t_divAngle + Math.PI))
                .attr("r", t_radius)
                .on("click", function(v_angle, v_i){
                    let t_active = d3.select(this).classed("active"),
                        t_indeces;
                    if(!t_active){
                        t_indeces = t_setDim(this, t_radius, v_i, 0, !t_active);
                    }else{
                        t_indeces = t_setDim(this, t_radius, v_i, -1, !t_active);
                    }
                    t_updateBars(t_indeces);
                });
                t_g.append("path")
                .classed("frame", true)
                .attr("d", t_setArc(1.0, t_arcR, t_arcAngle));
                let t_indeces = t_setDim(d3.selectAll(".SubMapDim"), t_radius, null, null, false);
                if(t_indeces.length == 0){
                    t_updateBars();
                }else{
                    t_updateBars(t_indeces);
                }
            },

            bindZooming: function(){
                let t_zoom = (v_zoomin) => {
                    let t_free = 0, t_fixed = 0;
                    for(let i = 0; i < this.dimCover.length; i++){
                        if(this.dimCover[i] < 0){
                            t_free ++;
                        }else{
                            t_fixed ++;
                        }
                    }
                    if((v_zoomin && t_free < 3) || (!this.zoomed && !v_zoomin)){
                        return;
                    }else{
                        if((!v_zoomin) || (v_zoomin && t_free < this.freeDim)){
                            this.zoomed = v_zoomin;
                            this.freeDim = v_zoomin?t_free:this.dimCover.length;
                            this.clearCanvas();
                            this.filtering();
                            this.showTiling();
                            this.showRing();
                        }
                    }
                };
                $("#ZoomIn").on("click", () => {t_zoom(true);});
                $("#ZoomOut").on("click", () => {t_zoom(false);});
            },

            bindTuning: function(){
                $("#Pattern")
                .on("click", ()=>{
                    let t_gs = d3.selectAll(".SubMapGrids");
                    this.pattern = !this.pattern;
                    SubGlyph.changeGlyph(t_gs, this.pattern, this.nghDims);
                    if(this.pattern){
                        $("#Pattern #text").text("Hide Pattern");
                    }else{
                        $("#Pattern #text").text("Show Pattern");
                    }
                })
            },

            aggregateCodes: function(v_codes, v_nghList){
                let t_codeLength = v_codes[0].length,
                    t_codeBook = new Map(),
                    t_codeNghDims = Basic.initArray(v_codes.length, t_codeLength);
                for(let i = 0; i < v_codes.length; i++){
                    t_codeBook.set(v_codes[i].join(""), 0);
                }
                for(let i = 0; i < t_codeLength; i++){
                    let t_code = new Array(t_codeLength).fill(0);
                    t_code[i] = 1;
                    t_codeBook.set(t_code.join(""), 0);
                }
                for(let i = 0; i < v_codes.length; i++){
                    let t_nghs = v_nghList[i], tt_code_i = v_codes[i];
                    for(let j = 0; j < t_nghs.length; j++){
                        let t_ngh = t_nghs[j],
                            tt_code_j = v_codes[t_ngh],
                            t_mask = new Array(t_codeLength).fill(0);
                        for(let k = 0; k < tt_code_i.length; k++){
                            if(tt_code_i[k] == tt_code_j[k]){
                                t_codeNghDims[i][k] ++;
                                t_mask[k] = 1;
                            }
                        }
                        t_mask = t_mask.join("");
                        if(!t_codeBook.has(t_mask)){
                            t_codeBook.set(t_mask, 0);
                        }
                        t_codeBook.set(t_mask, t_codeBook.get(t_mask) + 1);
                    }
                }
                let t_aggregate = new Map(t_codeBook);
                t_codeBook.forEach((v_count, v_code) => {
                    t_codeBook.forEach((vv_count, vv_code) => {
                        if(v_code == vv_code){
                            return;
                        }else{
                            let tt_code_i = v_code.split(""),
                                tt_code_j = vv_code.split(""),
                                t_unfit = false;
                            for(let i = 0; i < tt_code_i.length; i++){
                                if(tt_code_i[i] == 0 && tt_code_j[i] == 1){
                                    t_unfit = true;
                                    break;
                                }
                            }
                            if(!t_unfit){
                                let tt_code = tt_code_j.join("");
                                t_aggregate.set(tt_code, t_aggregate.get(tt_code) + 1);
                            }
                        }
                    });
                });
                t_codeNghDims.extent = Basic.extArray(t_codeNghDims);
                this.nghDims = t_codeNghDims;
                this.aggregate = t_aggregate;
                t_aggregate = Basic.mapToArray(this.aggregate, "entries");
                let t_aggrMax = -Infinity, t_aggrMin = Infinity;
                for(let i = 0; i < t_aggregate.length; i++){
                    if(eval(t_aggregate[i][0].split("").join("+")) == 1){
                        continue;
                    }
                    if(t_aggregate[i][1] > t_aggrMax){
                        t_aggrMax = t_aggregate[i][1];
                    }
                    if(t_aggregate[i][1] < t_aggrMin){
                        t_aggrMin = t_aggregate[i][1];
                    }
                }
                return [t_aggrMin, t_aggrMax];
            },

            showGrids: function(){
                var self = this, t_scales = self.parameter.scales, t_dims = self.collection.dimCount;
                var t_grids = [], t_gridScale, t_gridSize;
                var t_projection = self.collection.projection;
                var initGrids = function(v_num, v_grids){
                    var t_xNum = v_num, t_xLength = 1 / t_xNum,
                        t_yLength = t_xLength * Math.sqrt(3)/2,
                        t_yTop = t_xLength * Math.sqrt(3)/3, 
                        t_yNum = Math.floor(1 / t_yLength);
                    var t_gridSize = t_xLength / 2;
                    for(var i = 0; i < t_yNum; i++){
                        var tt_grids = [];
                        for(var j = 0; j < t_xNum; j++){
                            var t_cords = [((i%2==1?1:0.5) + j) * t_xLength, t_yTop + i * t_yLength];
                            var tt_grid = {count: 0, cords: t_cords, dims: new Array(t_dims).fill(0)};
                            tt_grids.push(tt_grid);
                        }
                        v_grids.push(tt_grids);
                    }
                    var t_getDist = function(vv_x, vv_y, vv_cords){
                        var tt_cords = v_grids[vv_y][vv_x].cords;
                        return {
                            index: [vv_y, vv_x],
                            dist: Math.pow(tt_cords[0] - vv_cords[0], 2) + Math.pow(tt_cords[1] - vv_cords[1], 2),
                        }
                    };
                    var t_gridScale = function(vv_x, vv_y){
                        var tt_y = (vv_y < t_yTop)?0:((vv_y - t_yTop) / t_yLength), tt_x;
                        var tt_yf = Math.floor(tt_y), tt_yc = Math.ceil(tt_y);
                        if(tt_yf == tt_yc){
                            if(tt_yf % 2 == 0){
                                tt_x = Math.floor(vv_x / t_xLength);
                            }else{
                                tt_x = (vv_x < t_xLength/2)?0:Math.floor(vv_x / t_xLength - 0.5);
                            }
                        }else{
                            var ttt_odd, ttt_even, ttt_dists = [];
                            if(tt_yf % 2 == 0){
                                ttt_odd = tt_yc;
                                ttt_even = tt_yf;
                            }else{
                                ttt_odd = tt_yf;
                                ttt_even = tt_yc;
                            }
                            var ttt_x = Math.floor(vv_x / t_xLength);
                            if(ttt_x == 0){
                                tt_x = 0;
                                ttt_dists[0] = (t_getDist(0, ttt_odd, [vv_x, vv_y]));
                                ttt_dists[1] = (t_getDist(0, ttt_even, [vv_x, vv_y]));
                                if(ttt_dists[0].dist < ttt_dists[1].dist){
                                    tt_y = ttt_odd;
                                }else{
                                    tt_y = ttt_even;
                                }
                            }else{
                                if(ttt_x == t_xNum){
                                    ttt_x = t_xNum - 1;
                                }
                                if(ttt_odd == t_yNum){
                                    ttt_odd--;
                                }
                                if(ttt_even == t_yNum){
                                    ttt_even--;
                                }
                                if(ttt_even < t_yNum){
                                    ttt_dists.push(t_getDist(ttt_x - 1, ttt_even, [vv_x, vv_y]));
                                    ttt_dists.push(t_getDist(ttt_x, ttt_even, [vv_x, vv_y]));
                                    if(ttt_x < t_xNum - 1){
                                        ttt_dists.push(t_getDist(ttt_x + 1, ttt_even, [vv_x, vv_y]));
                                    }
                                }
                                if(ttt_odd < t_yNum){
                                    ttt_dists.push(t_getDist(ttt_x, ttt_odd, [vv_x, vv_y]));
                                    if(ttt_x < t_xNum - 1){
                                        ttt_dists.push(t_getDist(ttt_x + 1, ttt_odd, [vv_x, vv_y]));
                                    }
                                }
                                ttt_dists.sort(function(a, b){
                                    return a.dist - b.dist;
                                });
                                // console.log(ttt_x, tt_x, t_xNum, tt_y, t_yNum, ttt_odd, ttt_even, ttt_dists);
                                tt_x = ttt_dists[0].index[1];
                                tt_y = ttt_dists[0].index[0];
                            }
                        }
                        return [tt_y, tt_x];
                    }
                    return {
                        scale: t_gridScale,
                        size: t_gridSize,
                    }
                };
                var aggrGrids = function(v_points, v_grids, v_gridScale){
                    var t_indeces = self.collection.subIndex;
                    for(var i = 0; i < v_points.length; i++){
                        var t_gridCords = v_gridScale(v_points[i][0], v_points[i][1]),
                            t_i = t_gridCords[0], t_j = t_gridCords[1];
                        v_grids[t_i][t_j].count++;
                        v_grids[t_i][t_j].dims = numeric.add(v_grids[t_i][t_j].dims, t_indeces[i]);
                    }
                    for(var i = 0; i < v_grids.length; i++){
                        for(var j = 0; j < v_grids[0].length; j++){
                            var t_count = v_grids[i][j].count;
                            if(t_count > 0){
                                v_grids[i][j].dims = numeric.div(v_grids[i][j].dims, t_count);
                            }
                        }
                    }
                };
                var showGlyph = function(v_g, v_r, v_dims, v_maxR){
                    var t_factor = 2 * Math.sqrt(3) / 3, 
                        t_maxR = v_maxR * t_factor, 
                        t_r = v_r * t_factor;
                    v_g.append("path")
                    .attr("d", d3.hexbin().hexagon(t_r))
                    .classed("cell", true);
                    if(v_r > 0){
                        var t_div = Math.PI * 2 / v_dims.length;
                        for(var i = 0; i < v_dims.length; i++){
                            var tt_ang = t_div * i;
                            v_g.append("line")
                            .attr("class", "weights")
                            .attr("x1", 0)
                            .attr("y1", 0)
                            .attr("x2", v_maxR * 0.8 * v_dims[i] * Math.cos(tt_ang))
                            .attr("y2", v_maxR * 0.8 * v_dims[i] * Math.sin(tt_ang));
                        }
                    }
                    v_g.append("path")
                    .attr("d", d3.hexbin().hexagon(t_maxR))
                    .classed("frame", true)
                    .classed("light", v_r==0);
                };
                var drawGrids = function(v_g, v_grids, v_gridSize, v_scales){
                    var tt_max = 0, tt_min = Infinity;
                    for(var i = 0; i < v_grids.length; i++){
                        for(var j = 0; j < v_grids[0].length; j++){
                            var ttt_count = v_grids[i][j].count;
                            if(ttt_count > tt_max){
                                tt_max = ttt_count;
                            }
                            if(ttt_count < tt_min){
                                tt_min = ttt_count;
                            }
                        }
                    }
                    var t_rSize = (v_scales.x.range()[1] - v_scales.x.range()[0]) / v_grids[0].length * 0.5;
                    var tt_rscale = d3.scale.linear().domain([tt_min, tt_max]).range([0, t_rSize]);
                    var tt_g = v_g.append("g")
                    .classed("SubMapGrids", true);
                    for(var i = 0; i < v_grids.length; i++){
                        var tt_jlength = v_grids[0].length - ((i%2==1)?1:0);
                        for(var j = 0; j < tt_jlength; j++){
                            var tt_pos = Basic.scale(v_scales, v_grids[i][j].cords);
                            var ttt_g = tt_g.append("g")
                            .classed("SubMapGrid", true)
                            .attr("id","SubMapGrid_"+i+"_"+j)
                            .attr("transform", "translate(" + tt_pos + ")");
                            showGlyph(ttt_g, tt_rscale(v_grids[i][j].count), v_grids[i][j].dims, t_rSize);
                        }
                    }
                };
                var t_gridsReturn = initGrids(Config.get("gridNumber"), t_grids);
                t_gridScale = t_gridsReturn.scale; t_gridSize = t_gridsReturn.size;
                aggrGrids(t_projection, t_grids, t_gridScale);
                drawGrids(self.d3el, t_grids, t_gridSize, t_scales);
            },

            showProjection: function(){
                var self = this, t_projection = self.collection.projection, 
                    t_scales = self.parameter.scales, t_r = self.parameter.r,
                    t_colors = self.collection.colors;
                self.d3el
                .append("g")
                .classed("SubMapModels", true)
                .selectAll(".SubMapModel")
                .data(self.collection.models)
                .enter()
                .append("g")
                .classed("SubMapModel", true)
                .attr("id", function(t_d){
                    return "SubMapModel_" + t_d.id;
                })
                .attr("transform", function(t_d){
                    var t_ind = t_d.id, t_pos = t_projection[t_ind];
                    return "translate(" + Basic.scale(t_scales, t_pos) + ")";
                })
                .on("click", function(t_d){
                    self.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__ShowProjection", data: t_d.subspace});
                })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", t_r)
                .attr("fill", function(t_d){
                    // var t_ind = t_d.id, t_col = t_colors[t_ind];
                    // t_col = [~~(255*t_col[0]), ~~(255*t_col[1]), ~~(255*t_col[2])];
                    // return "rgb(" + t_col + ")";
                    return "#000"
                })
                .append("title")
                .text(function(t_d){
                    return t_d.code;
                });
            },

            showModels: function(){
                let t_td = this.collection.tpModel.TDims, t_scales = this.parameter.scales, t_r = this.parameter.r;
                let t_m = numeric.transpose(this.collection.tpModel.DTMatrix), t_sum = numeric.sum(t_m);
                let t_arc = d3.svg.arc(), t_ratio = 3;
                let t_g = this.d3el.selectAll(".SubMapTopics")
                .data(t_td)
                .enter()
                .append("g")
                .classed("SubMapTopics", true)
                .attr("transform", function(t_d, t_i){
                    let t_pos = [1.1, t_i * 1/(t_td.length + 1)];
                    return "translate(" + Basic.scale(t_scales, t_pos) + ")";
                });
                t_g.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", function(t_d, t_i){
                    return t_r * t_ratio * 1.5 * numeric.sum(t_m[t_i]) / t_sum;
                })
                .attr("fill","#000")
                .on("mouseover", function(t_d, t_i){
                    d3.select($(this).parent()[0])
                    .selectAll("path")
                    .attr("stroke-width", 3);
                    d3.selectAll(".SubMapModel")
                    .attr("opacity", function(){
                        let t_id = $(this).attr("id").replace("SubMapModel_", ""),
                        t_sum = numeric.sum(t_m[t_i]);
                        let t_mx = _.max(t_m[t_i]), t_mn = _.min(t_m[t_i]), t_w = (t_m[t_i][t_id] - t_mn)/(t_mx - t_mn);
                        return t_w;
                    })
                })
                .on("mouseout", function(){
                    d3.select($(this).parent()[0])
                    .selectAll("path")
                    .attr("stroke-width", 1);
                    d3.selectAll(".SubMapModel")
                    .attr("opacity", 1);
                });
                let t_step = Math.PI*2/(t_td[0].length);
                for(let i = 0; i < t_td[0].length; i++){
                    t_g.append("path")
                    .attr("d", function(t_d){
                        t_arc.startAngle(i * t_step)
                        .endAngle((i+1) * t_step)
                        .innerRadius(t_r * t_ratio)
                        .outerRadius(t_r * t_ratio * (1 + 2 * t_d[i]));
                        return t_arc();
                    })
                    .attr("stroke", "#000")
                    .attr("fill", "none");
                }
            },

            clearAll: function(){
                let t_clean = {
                    dimCover: new Array(this.collection.dimCount).fill(-1),
                    distMat: null,
                    diffMat: null,
                    distExt: null,
                    nghList: null,
                    zoomed: false,
                    pattern: false,
                    aggregate: null,
                    nghDims: null,
                    freeDim: null,
                    fCodes: null,
                    fMatrix: null,
                    colors: null,
                    colorFixed: false,
                }
                Object.assign(this, t_clean);
                $("#Pattern #text").text("Show Pattern");
            },

            clearCanvas: function(){                
                this.d3el.selectAll("g").remove();
                this.collection.trigger("Transmission", {type: "trans", message: "SubMapCollectionView__HideProjection", data: null});
            },
        },Base));

        return SubMap_CollectionView;
    });
