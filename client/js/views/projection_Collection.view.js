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
    'SubMap_ModelView',
    ], function(require, Mn, _, $, Backbone, Datacenter, Config, Base, Hdpainter, loadBasic, loadBasicView, MST, SubMap_ModelView) {
        'use strict';

        String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        };

        var Projection_CollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            attributes: {
                "id":"Projection",
            },

            childView: SubMap_ModelView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            init: function(){
                var t_width = parseFloat($("#Projection_CollectionViewSVG").css("width")),
                t_height = parseFloat($("#Projection_CollectionViewSVG").css("height")),
                t_size = Math.min(t_width, t_height);
                var t_left = (t_width - t_size) / 2 + t_size * 0.05, t_top = (t_height - t_size) / 2 + t_size * 0.05;
                var t_defaults = {
                    canvasSize: Config.get("drawSize"),
                    size: t_size,
                    canvasRange: [[t_left, t_left + t_size * 0.9], [t_top, t_top + t_size * 0.9]],
                    scale: {
                        x: d3.scale.linear().range([t_left, t_left + t_size * 0.9]),
                        y: d3.scale.linear().range([t_top, t_top + t_size * 0.9]),
                    },
                    defaultCode: null,
                    defaultProjection: null,
                    fontSize: 12,
                    ready: false,
                    hover: {
                        timer: null,
                        time: 1500,
                        shown: null,
                    },
                    transition: Config.get("transition"),
                    parameter: {
                        size: t_size,
                        r: 6,
                    },
                    painter: HDPainter.init(this.d3el, {
                        canvasRange: [[t_left, t_left + t_size * 0.9], [t_top, t_top + t_size * 0.9]],
                        tooltipContainer: "#rightTop",
                        interSteps: this.collection.frames,
                    }),
                    filterers: {
                        highlight: BasicView.filter({
                            container: this.d3el,
                            overallSelector: ".ProjectionPoint",
                            overallKey: "index",
                            overallFilterFunc: null,
                            subSelector: null,
                            controlAttr: "fill",
                            static: {
                                attrs: ["class"],
                                match: ["chosen"],
                                miss: [null],
                                normal: [false],
                            },
                            animation: () => {},
                        }),
                        dataLength: 0,
                        IDs: null,
                        colorScale: d3.scale.linear().range([0,1]),
                        colorExtent: [[192, 192, 192], [0, 0, 0]],
                        colorArray: null,
                    },
                };
                _.extend(this, t_defaults);
            },

            initialize: function (options) {
                var self = this;
                this.init();
                options = options || {};
                _.extend(this, options);
                this.layout = Config.get("childviewLayout");
                this.bindAll();
            },

            onShow: function(){
                let t_width = parseFloat($("#Projection_CollectionViewSVG").css("width")),
                    t_height = parseFloat($("#Projection_CollectionViewSVG").css("height")),
                    t_scale = this.size / this.canvasSize,
                    t_translate = [t_width / 2, t_height / 2];
                d3.select("#Projection_CollectionView")
                .attr("transform", "translate(" + t_translate + ")scale(" + t_scale + ")");
            },

            bindAll: function(){
                this.listenTo(Datacenter, "SubMapCollectionView__DimensionFiltering", this.getDefaultProjection)
                this.listenTo(Datacenter, "SubMapCollectionView__ShowProjection", this.getProjection);
                this.listenTo(Datacenter, "SubMapCollectionView__DefaultProjection", this.restoreProjection);
                this.listenTo(Datacenter, "SubMapCollectionView__HideProjection", this.hideProjection);
                this.listenTo(Datacenter, "SubMapCollectionView__ShowClusters", this.showClusters);
                this.listenTo(Datacenter, "SubMapCollectionView__UpdateClusters", this.updateClusters);
                this.listenTo(Datacenter, "SubMapCollectionView__Highlighting", this.updateHighlighting);
                // this.listenTo(Datacenter, "SubMapCollectionView__Choose", this.updateHighlighting_v0);
                // this.listenTo(Datacenter, "SubMapCollectionView__Pin", this.updatePinning);
                this.listenTo(this.collection, "ProjectionCollection__ShowProjection", this.saveProjection);
                this.listenTo(this.collection, "ProjectionCollection__ClearAll", this.clearAll);
            },

            getDefaultProjection: function(v_filterObj){
                let t_codeLength = v_filterObj.codeLength,
                    t_dimCover = v_filterObj.dimCover,
                    t_defaultCode = new Array(t_codeLength).fill(1);
                if(this.defaultCode == null){
                    this.defaultCode = new Array(t_codeLength).fill(1);
                }
                if(t_dimCover != null){
                    for(let i = 0; i < t_codeLength; i++){
                        if(t_dimCover[i] == 0){
                            t_defaultCode[i] = 0;
                        }
                    }
                }
                this.collection.getProjection(t_defaultCode);
            },

            restoreProjection: function(){
                this.collection.getProjection(this.defaultCode);
            },

            getProjection: function(v_code){
                this.collection.getProjection(v_code);
            },

            hideProjection: function(){
                this.d3el.selectAll("g").remove();
            },

            updateProjection: function(v_proj){
                var self = this, t_scales = self.parameter.scales, t_r = self.parameter.r, t_max = Config.get("data").maxVector;
                t_scales.x.domain([-t_max * 0.8, t_max * 0.8]);
                t_scales.y.domain([-t_max * 0.8, t_max * 0.8]);
                self.clearAll();
                self.d3el.selectAll(".ProjectionPoint")
                .data(v_proj)
                .enter()
                .append("g")
                .classed("ProjectionPoint", true)
                .attr("id", function(t_d, t_i){
                    return "ProjectionPoint_" + t_i;
                })
                .attr("transform", function(t_d){
                    return "translate(" + Basic.scale(t_scales, t_d) + ")";
                })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", t_r);
            },

            showBackground: function(){
                if(this.d3el.select(".projBackground").empty()){
                    this.d3el
                    .append("g")
                    .attr("class","projBackground")
                    .append("rect")
                    .attr("x", - this.canvasSize / 2)
                    .attr("y", - this.canvasSize / 2)
                    .attr("width", this.canvasSize)
                    .attr("height", this.canvasSize);
                }
            },

            showClusters: function(t_clsInfo){
                let t_maxSize = 100, t_this = this, t_proj = this.defaultProjection,
                    t_distFunc = (a,b) => {return (a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]);};
                let t_getParameters = (v_centers, v_counts)=>{
                    let t_length = v_counts.length, t_positions = Basic.initArray(t_length, 2),
                        t_sizes = new Array(t_length), t_sortedCounts = Basic.sortVector(v_counts, false),
                        t_maxCount = t_sortedCounts.value[0],
                        t_maxInd = t_sortedCounts.index[0], t_centers = new Array(),
                        t_edges = MST.euclideanMST(v_centers, t_distFunc),
                        t_ready = new Array(t_length).fill(false);
                    let t_handlePoint = (v_i) => {
                        let t_selfCenter = v_centers[v_i], t_selfPosition = t_positions[v_i], t_selfSize = t_sizes[v_i];
                        for(let i = 0; i < t_edges.length; i++){
                            let t_edge_i = t_edges[i], t_next;
                            if(t_edge_i[0] == v_i){
                                t_next = t_edge_i[1];
                            }
                            if(t_edge_i[1] == v_i){
                                t_next = t_edge_i[0];
                            }
                            if(t_next == undefined || t_ready[t_next]){
                                continue;
                            }else{
                                let t_angle = Basic.getAngle(t_selfCenter, v_centers[t_next]),
                                    t_size = t_sizes[t_next] = v_counts[t_next] / t_maxCount * t_maxSize,
                                    t_r = t_size + t_selfSize;
                                t_positions[t_next] = [t_selfPosition[0] + t_r * Math.cos(t_angle), t_selfPosition[1] + t_r * Math.sin(t_angle)];
                                t_ready[t_next] = true;
                                t_handlePoint(t_next);
                            }
                        }
                    };
                    t_positions[t_maxInd] = [0,0];
                    t_sizes[t_maxInd] = t_maxSize;
                    t_ready[t_maxInd] = true;
                    t_handlePoint(t_maxInd);
                    return {
                        position: t_positions,
                        size: t_sizes,
                        edge: t_edges,
                    };
                },  t_renderClsBox_level = (v_levelInfo, v_level, v_g, v_hidden = true)=>{
                    let t_centers = new Array(),
                        t_counts = new Array(),
                        t_boundingBox = [[Infinity, -Infinity], [Infinity, -Infinity]],
                        t_dimNum = v_levelInfo[0].weights.length,
                        t_divAngle = 2 * Math.PI / t_dimNum;
                    for(let i = 0; i < v_levelInfo.length; i++){
                        let t_info = v_levelInfo[i];
                        t_centers.push(t_info.center);
                        t_counts.push(t_info.count);
                    }
                    let t_parameters = t_getParameters(t_centers, t_counts),
                        t_g = v_g.append("g")
                        .attr("class", "ClsLevelProjection")
                        .attr("id", "ClsLevelProjection_" + v_level)
                        .attr("display", v_hidden?"none":"block");
                    let t_projBoxes = t_g.selectAll(".ClsProjection")
                        .data(v_levelInfo)
                        .enter()
                        .append("g")
                        .attr("class", "ClsProjection")
                        .attr("clsID", (v_d)=>{
                            return v_d.clsID.join("_");
                        })
                        .attr("id", (v_d)=>{
                            return "ClsProjection_" + v_d.clsID.join("_");
                        });
                    for(let i = 0; i < v_levelInfo.length; i++){
                        let t_r = t_parameters.size[i],
                            t_center = t_parameters.position[i];
                        if(t_center[0] - t_r < t_boundingBox[0][0]){
                            t_boundingBox[0][0] = t_center[0] - t_r;
                        }
                        if(t_center[0] + t_r > t_boundingBox[0][1]){
                            t_boundingBox[0][1] = t_center[0] + t_r;
                        }
                        if(t_center[1] - t_r < t_boundingBox[1][0]){
                            t_boundingBox[1][0] = t_center[1] - t_r;
                        }
                        if(t_center[1] + t_r > t_boundingBox[1][1]){
                            t_boundingBox[1][1] = t_center[1] + t_r;
                        }
                    }
                    let t_center = Basic.getMeanVector(t_boundingBox, true),
                        t_sizes = [(t_boundingBox[0][1] - t_boundingBox[0][0])/0.9, (t_boundingBox[1][1] - t_boundingBox[1][0])/0.9],
                        t_scale = this.canvasSize / d3.max(t_sizes),
                        t_swidth = 5 / t_scale;
                    //circles
                    t_projBoxes.append("circle")
                    .attr("cx", (v_d, v_i)=>{
                        return t_parameters.position[v_i][0];
                    })
                    .attr("cy", (v_d, v_i)=>{
                        return t_parameters.position[v_i][1];
                    })
                    .attr("r", (v_d, v_i)=>{
                        return t_parameters.size[v_i] - t_swidth / 2;
                    })
                    //注意，这里的size和半径成正比了，会导致对面积的perception出错
                    .attr("fill", (v_d, v_i) => {
                        return BasicView.colToRgb(v_levelInfo[v_i].color);
                    })
                    .attr("fill-opacity", 0.4)
                    .attr("stroke", (v_d, v_i) => {
                        return BasicView.colToRgb(v_levelInfo[v_i].color);
                    })
                    .attr("stroke-width", t_swidth)
                    .attr("opacity", 0.2);
                    //paths
                    t_projBoxes
                    .each(function(v_d, v_i){
                        let t_weights = v_levelInfo[v_i].weights,
                            t_r = t_parameters.size[v_i],
                            t_color = BasicView.colToRgb(v_levelInfo[v_i].color),
                            t_gapAngle = Math.PI / 18;
                        let t_g = d3.select(this)
                        .append("g")
                        .attr("transform", "translate(" + t_parameters.position[v_i] + ")");
                        t_g.selectAll("path")
                        .data(t_weights)
                        .enter()
                        .append("path")
                        .attr("d", (vv_d, vv_i)=>{
                            let t_range = (vv_d * t_divAngle - t_gapAngle),
                                t_arc = d3.svg.arc()
                                .innerRadius(t_r - t_swidth)
                                .outerRadius(t_r)
                                .startAngle(vv_i * t_divAngle + 0.5 * t_divAngle - t_range / 2)
                                .endAngle(vv_i * t_divAngle + 0.5 * t_divAngle + t_range / 2);
                            return t_arc();
                        })
                        .attr("fill", t_color);
                        t_g.selectAll("line")
                        .data(t_weights)
                        .enter()
                        .append("line")
                        .attr("x1", (vv_d, vv_i)=>{return (t_r - t_swidth) * Math.cos(vv_i * t_divAngle);})
                        .attr("x2", (vv_d, vv_i)=>{return t_r * Math.cos(vv_i * t_divAngle);})
                        .attr("y1", (vv_d, vv_i)=>{return (t_r - t_swidth) * Math.sin(vv_i * t_divAngle);})
                        .attr("y2", (vv_d, vv_i)=>{return t_r * Math.sin(vv_i * t_divAngle);})
                        .attr("stroke","#fff")
                        .attr("stroke-width", t_swidth / 2);
                        t_this.showProjection(t_g, t_r - t_swidth, t_proj, v_levelInfo[v_i].data);
                    });
                    //edges
                    // t_g.append("g")
                    // .attr("class","ClsEdges")
                    // .selectAll(".edges")
                    // .data(t_parameters.edge)
                    // .enter()
                    // .append("g")
                    // .attr("class", "ClsEdge")
                    // .append("line")
                    // .attr("x1", (v_e)=>{
                    //     return t_parameters.position[v_e[0]][0];
                    // })
                    // .attr("x2", (v_e)=>{
                    //     return t_parameters.position[v_e[1]][0];
                    // })
                    // .attr("y1", (v_e)=>{
                    //     return t_parameters.position[v_e[0]][1];
                    // })
                    // .attr("y2", (v_e)=>{
                    //     return t_parameters.position[v_e[1]][1];
                    // })
                    // .attr("stroke","#000")
                    // .attr("stroke-width", "3px");
                    t_g.attr("transform", "translate(" + [-t_center[0] * t_scale, -t_center[1] * t_scale] + ")scale(" + t_scale + ")");
                },  t_renderClsBox = ()=>{
                    for(let i = 0; i < t_clsInfo.length; i++){
                        let t_info = t_clsInfo[i],
                            t_hidden = !(i == 0);
                        t_renderClsBox_level(t_info, i, this.d3el, t_hidden);
                    }
                };
                this.showBackground();
                t_renderClsBox();
            },

            updateClusters: function(t_clsInfo){
                for(let i = 0; i < t_clsInfo.length; i++){
                    let t_level = t_clsInfo[i], t_invisibleLevel;
                    for(let j = 0; j < t_level.length; j++){
                        let t_info = t_level[j], t_clsID = t_info.clsID;
                        if(t_invisibleLevel == undefined){
                            t_invisibleLevel = !t_info.visible;
                        }else{
                            t_invisibleLevel = t_invisibleLevel && (!t_info.visible);
                        }
                        this.d3el.select("#ClsProjection_" + t_clsID).attr("display", t_info.visible?"block":"none");
                    }
                    this.d3el.select("#ClsLevelProjection_" + i).attr("display", t_invisibleLevel?"none":"block");
                }
            },

            saveProjection: function(v_cords, v_projections, v_interpolate){
                this.defaultProjection = v_projections;
            },

            showProjection: function(v_g, v_radius, v_proj, v_weights){
                let t_scale = d3.scale.linear().domain([-0.32, 0.32]).range([-v_radius, v_radius]),
                    t_colScale = d3.scale.linear().domain([Math.min(...v_weights), Math.max(...v_weights)]).range([0.1, 1]);
                v_g.append("g")
                .attr("class", "Projection")
                .selectAll(".ProjectionPoint")
                .data(v_proj)
                .enter()
                .append('circle')
                .attr("cx", (v_d) => {
                    return t_scale(v_d[0]);
                })
                .attr("cy", (v_d) => {
                    return t_scale(v_d[1]);
                })
                .attr("r", 2)
                .attr("fill", function(v_d, v_i){
                    let t_col = 1-t_colScale(v_weights[v_i]);
                    return BasicView.colToRgb([t_col,t_col,t_col]);
                })
                .attr("class", "ProjectionPoint");
            },

            // showProjection_v2: function(v_cords, v_projections, v_interpolate){
            //     this.painter.setCanvas(this.d3el);
            //     this.painter.stopAll();
            //     this.painter.setData(Config.get("data").data, Config.get("data").dimensions.values());
            //     this.painter.drawBiplot(v_projections, v_cords, v_interpolate);
            // },

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

            initializeFilter: function(v_filterer){
                let t_animateFunc = (v_d3selection, v_fit) => {
                    let t_cols = this.filterers.colorArray,
                        t_colExt = this.filterers.colorExtent;
                    if(v_fit && t_cols != null){
                        v_d3selection
                        .filter(function(){
                            return !d3.select(this).classed("pinned");
                        })
                        .selectAll("circle")
                        .interrupt()
                        .transition()
                        .attr("fill", function(){
                            let t_index = d3.select($(this).parent()[0]).attr("index");
                            return "rgb(" + t_cols[t_index] + ")";
                        });
                    }else{
                        v_d3selection
                        .filter(function(){
                            return !d3.select(this).classed("pinned");
                        })
                        .selectAll("circle")
                        .interrupt()
                        .transition()
                        .attr("fill", function(){
                            return "rgb(" + t_colExt[0] + ")";
                        });
                    }
                };
                v_filterer.animation = t_animateFunc;
                v_filterer.init();
            },

            updateHighlighting: function(v_clsID){
                if(v_clsID == null){
                    this.d3el.selectAll(".ClsProjection")
                    .interrupt()
                    .transition()
                    .duration(400)
                    .attr("opacity",1);
                }else{
                    this.d3el.selectAll(".ClsProjection")
                    .interrupt()
                    .transition()
                    .duration(400)
                    .attr("opacity",0.5);
                    this.d3el.select("#ClsProjection_" + v_clsID.join("_"))
                    .interrupt()
                    .transition()
                    .duration(400)
                    .attr("opacity",1);
                }
            },

            updateHighlighting_v0: function(v_options){
                let t_filterers = this.filterers,
                    t_filterer = t_filterers.highlight,
                    t_attr = v_options.attr,
                    t_highlightIDs = t_filterers.IDs,
                    t_weights = v_options.weights,
                    t_result;
                if(!t_filterer.ready){
                    this.initializeFilter(t_filterer);
                }
                if(t_highlightIDs == null){
                    let t_length = t_filterer.dataLength = Config.get("data").data.length;
                    t_highlightIDs = new Array(t_length);
                    for(let i = 0; i < t_length; i++){
                        t_highlightIDs[i] = i + "";
                    }
                    t_filterers.IDs = t_highlightIDs;
                }
                if(t_weights == null){
                    t_result = t_filterer.restore("projection_highlighting", false);
                }else{
                    let t_colScale = t_filterers.colorScale, t_colArray = t_filterers.colorArray, t_colExt = t_filterers.colorExtent;
                    t_colScale.domain(d3.extent(t_weights));
                    if(t_colArray == null){
                        t_colArray = Basic.initArray(t_weights.length, 3);
                        t_filterers.colorArray = t_colArray;
                    }
                    for(let i = 0; i < t_weights.length; i++){
                        let t_ratio = t_colScale(t_weights[i]);
                        t_colArray[i][0] = ~~((t_colExt[1][0] - t_colExt[0][0]) * t_ratio + t_colExt[0][0]);
                        t_colArray[i][1] = ~~((t_colExt[1][1] - t_colExt[0][1]) * t_ratio + t_colExt[0][1]);
                        t_colArray[i][2] = ~~((t_colExt[1][2] - t_colExt[0][2]) * t_ratio + t_colExt[0][2]);
                    }
                    if(v_options.IDs.length > 0){
                        t_result = t_filterer.filter("projection_highlighting", t_attr, t_highlightIDs);
                    }else{
                        t_result = t_filterer.restore("projection_highlighting", false);
                    }
                }
            },

            updatePinning: function(v_options){
                let t_filterers = this.filterers,
                    t_filterer = t_filterers.highlight,
                    t_attr = v_options.attr,
                    t_pinIDs = t_filterers.IDs,
                    t_d3el = this.d3el,
                    t_result;
                if(v_options.IDs != null && v_options.IDs.length > 0){
                    t_d3el.selectAll(".ProjectionPoint")
                    .classed("pinned", false);
                    t_result = t_filterer.pick("projection_pinning", t_attr, t_pinIDs);
                    t_d3el.selectAll(".ProjectionPoint")
                    .classed("pinned", true);
                }else{
                    t_d3el.selectAll(".ProjectionPoint")
                    .classed("pinned", false);
                    t_result = t_filterer.restore("projection_pinning", false);
                }
            },

            clearAll: function(){
                this.painter.clearAll();
                this.init();
            },
        },Base));

    return Projection_CollectionView;
});
