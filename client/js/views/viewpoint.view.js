/**
 * Created by Chufan Lai at 2015/12/14
 * view for each viewpoint projection
 */
 define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'text!templates/viewpoint.tpl',
    'Base',
    'hull',
    ], function(require, Mn, _, $, Backbone, Datacenter, Config, Tpl, Base, Hull) {
        'use strict';

        String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        }

        var insidePolygon = function (t,r){
            var e=false,n=-1;
            for(var i=t.length,a=i-1;++n<i;a=n)
                if( (t[n][1]<=r[1] && r[1]<t[a][1] || t[a][1]<=r[1] && r[1]<t[n][1]) &&
                    r[0]<(t[a][0]-t[n][0])*(r[1]-t[n][1])/(t[a][1]-t[n][1])+t[n][0])
                    e=!e;
                return e
            };

            var ViewpointView = Mn.ItemView.extend(_.extend({

                tagName:"g",

                class: "ViewpointView",

                events: {
                },

                template: _.template(Tpl),

                attributes:{
                },

                initialize: function (v_options) {
                    var self = this;
                    v_options = v_options || {};
                    var t_defaults = {
                        id: null,
                        scale: {
                            x: d3.scale.linear(),
                            y: d3.scale.linear(),
                        },
                        padding: 0.02,
                        size: null,
                        point: {
                            rRatio: 0.01,
                            r: null,
                            rChange: null,
                        },
                        dimBar: {
                            ovlHeight: 150,
                            histoHeight: 80,
                            ovlLeft: 2,
                            innerLeft: 18,
                            width: null,
                            height: null,
                            top: null,
                            left: null,
                            position: null,
                            maxLength: 5,
                            angle: 45,
                            brush: null,
                            scale: null,
                            brushed: null,
                            count: null,
                        },
                        suggestion: {
                            newpoint: (Config.get("suggestion")=="New" && Config.get("focusType")=="Point"),
                            newgroup: (Config.get("suggestion")=="New" && Config.get("focusType")=="Group"),
                            oldgroup: {
                                Add: (Config.get("focusType")=="Group" && Config.get("modification") == "Add"),
                                Minus: (Config.get("focusType")=="Group" && Config.get("modification") == "Minus"),
                            },
                            info: {
                                "New": "On",
                                "Old": "Modify",
                            },
                            modiInfo: {
                                "Add": "Increase",
                                "Minus": "Decrease",
                            },
                        },
                        hover: {
                            timer: null,
                            time: 1500,
                            shown: null,
                        },
                        g: null,
                        focus_opc: 1.0,
                        context_opc: 0.1,
                        ready: false,
                        infoReady: false,
                        state: null,
                        stopAction: false,
                        error_r: null,
                        vectorR: [0,9],
                        classColors: Config.get("clusterColors"),
                        drawLine: Config.get("showVector"),
                        lightingOn: Config.get("lightingOn"),
                        groupOn: Config.get("groupOn"),
                        lasso: [],
                        lassoPath: [],
                        focus: [],
                        data_size: null,
                        mouseOutChange: Config.get("mouseOver"),
                        infoToggle: true,
                        opacityDark: 0.6,
                        clusterInfo: false,
                        modifyInfo: false,
                        clusterShown: false,
                        projection: null,
                    };
                    _.extend(this, t_defaults);
                    _.extend(this, v_options);
                    this.id = this.model.id;
                    this.state =this.model.state;
                    this.g = d3.select(this.$el[0]);
                    this.bindAll();
                    this.bindInteractions();
                    this.parent = $("#leftBottom")[0];
                },

                bindAll: function(){
                    this.listenTo(this.model, "Viewpoint__ProjectionUpdate", this.showProjection);
                    this.listenTo(this.model, "Viewpoint__FocusUpdate", this.showFocus);
                    this.listenTo(this.model, "Viewpoint__AxesUpdate", this.showAxis);
                    this.listenTo(this.model, "Viewpoint__UpdateClusterInfo", this.updateClusterInfo);
                    this.listenTo(this.model, "Viewpoint__UpdateModifyInfo", this.updateModifyInfo);
                    this.listenTo(this.model, "Viewpoint__GetClusterCord", this.getClusterCord);
                    this.listenTo(this.model, "Viewpoint__drawGroupModify", this.updateModify);
                    this.listenTo(this.model, "Viewpoint__GetModifyCord", this.getModifyCord);
                    this.listenTo(Config, "change:showVector", this.showVector);
                    this.listenTo(Config, "change:changeOptimization", this.changeOptimization);
                    this.listenTo(Config, "change:changeSubspace", this.changeSubspace);
                    this.listenTo(Config, "change:optimization", this.changeOptiInfo);
                    this.listenTo(Config, "change:showAxis", this.showAxis);
                    this.listenTo(Config, 'change:focusType', this.changeFocusType);
                    this.listenTo(Config, "change:currentData", this.changeData);
                    this.listenTo(Config, 'change:changeSuggestion', this.toggleSuggestion);
                    this.listenTo(Config, "change:showContext", this.changeContext);
                },

                onShow: function(){
                    var t_layout = this.model.layout, t_top = t_layout.top, t_left = t_layout.left, t_size = t_layout.size;
                    var self = this;
                    self.initInfoPanel();
                    // d3.select($(this.g[0]).parent("g")[0])
                    // .call(d3.behavior.zoom().scaleExtent([1, 8]).on("zoom", function zoom() {
                    //     self.g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
                    // }));
                    self.d3el
                    .attr("transform","translate("+t_left+","+t_top+")")
                    .attr("id","ViewpointView_"+this.id)
                    .classed("vpShown",true)
                    .style("opacity", 0);
                    self.d3el
                    .transition()
                    .ease("linear")
                    .duration(self.transition.duration)
                    .style("opacity",1);
                    self.d3el
                    .append("rect")
                    .attr("x",0)
                    .attr("y",0)
                    .attr("width",t_size)
                    .attr("height",t_size)
                    .attr("fill",Config.get("lighting")=="light"?Config.get("color").median:Config.get("color").dark)
                    .classed("viewpointBackground",true);
                // this.d3el
                // .append("circle")
                // .attr("cx",t_size/2)
                // .attr("cy",t_size/2)
                // .attr("r",t_size/2)
                // .attr("fill",Config.get("lighting")=="light"?Config.get("color").median:Config.get("color").dark)
                // .classed("viewpointBackground",true);
                var t_padding = t_size*self.padding;
                self.scale.x.range([t_padding, t_size - t_padding]);
                self.scale.y.range([t_padding, t_size - t_padding]);
                self.size = t_size;
                self.point.r = 4;
                //renderPlus
                var t_pSize = t_padding * 1.5, t_plus = $("#AddCluster");
                // t_plus = self.renderPlus(self.d3el, [self.scale.x.range()[1] - t_padding, self.scale.y.range()[0] + t_padding], t_pSize);
                t_plus.on("click",function(){
                    $(this).tooltip("hide");
                    self.trigger("ViewpointView__AddViewpoint");
                });
                self.trigger("ViewpointView__getProjection");
            },

            renderPlus: function(v_g, v_pos, v_size){
                var t_g = v_g.append("g")
                .attr("class","ViewpointPlus")
                .attr("transform","translate("+v_pos+")");
                t_g.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", v_size * 0.8);
                t_g.append("rect")
                .attr("x", -v_size*0.5)
                .attr("y", -v_size*0.1)
                .attr("width", v_size)
                .attr("height", v_size*0.2);
                t_g.append("rect")
                .attr("x", -v_size*0.1)
                .attr("y", -v_size*0.5)
                .attr("width", v_size*0.2)
                .attr("height", v_size);
                return t_g;
            },

            toRender: function(v_options){
            },

            showFocus: function(v_sign){
                var self = this, t_over = Config.get("mouseOver");
                var t_vp = this.model.focus;
                var t_dark = Config.get("lightColor").dark, t_light = Config.get("lightColor").median, t_spotlight = Config.get("lightColor").light;
                var t_col = Config.get("currentColor");
                var t_new = (Config.get("suggestion") == "New" && Config.get("focusType") == "Point");
                self.focus = this.model.focus;
                var t_focus_size = (self.focus.length == 0?self.data_size:self.focus.length);
                var t_proportion = parseFloat(( t_focus_size/ self.data_size * 100).toPrecision(3));
                var t_change = this.point.rChange;
                this.changePanel("FocusInfo", t_focus_size+" ("+t_proportion+"%)", true);
                self.d3el.selectAll(".vpProjectionPoint").classed("groupMember",false);
                if(!t_over){
                    self.d3el.selectAll(".vpProjectionPoint circle")
                    .attr("color", t_dark)
                    .transition()
                    .duration(self.transition.duration)
                    .ease("linear")
                    .attr("fill", function(){
                        var tt_col = d3.interpolateHsl(t_spotlight, $(this).attr("color"));
                        return tt_col(0.2);
                    })
                    .attr("r", function(){
                        if(t_new){
                            return $(this).attr("radius");
                        }else{
                            return self.point.r;
                        }
                    });
                }
                if(t_vp.length>0){
                    for(var i in t_vp){
                        self.d3el.select("#vpProjectionPoint_"+t_vp[i])
                        .classed("groupMember",true)
                        .select("circle")
                        .attr("color", t_col);
                    // .classed("groupFocus", (!t_over));
                }
                self.d3el.selectAll(".groupMember circle")
                .interrupt()
                .transition()
                .duration(self.transition.duration)
                .attr("fill", function(){
                    return $(this).attr("color");
                })
                .attr("r", function(){
                    if(t_new){
                        return $(this).attr("radius");
                    }else{
                        return self.point.r;
                    }
                });//t_dark
                // var tt_pos = [];
                // tt_pos[0] = t_scale.x(t_vp[0]);
                // tt_pos[1] = t_scale.y(t_vp[1]);
                // this.d3el.select(".vpLantern")
                // .transition()
                // .ease("linear")
                // .duration(self.transition.interval)
                // .attr("transform","translate("+tt_pos+")");
            }else{
                if(!t_over){
                    self.d3el.selectAll(".vpProjectionPoint circle")
                    .interrupt()
                    .transition()
                    .duration(self.transition.duration)
                    .attr("fill", function(){
                        return $(this).attr("color");
                    })
                    .attr("r", function(){
                        if(t_new){
                            return $(this).attr("radius");
                        }else{
                            return self.point.r;
                        }
                    });//t_dark
                }
            }
            self.fixProjection();
        },

        showProjection: function(v_start, v_cord){
            var tt_data = Config.get("data"), self = this, t_scale = this.scale, t_shorter = 0.9, t_longer  = 0.95, t_dimensions = tt_data.dimensions.values(),
            tt_scale = {x: d3.scale.linear().domain([0,1]).range(self.vectorR), y: d3.scale.linear().domain([0,1]).range(self.vectorR)};
            var t_error = this.model.errors, t_mx = d3.max(t_error), t_mn = d3.min(t_error), t_vector = self.model.vectors,
            t_er_r = this.error_r = function(t_i){ return self.point.r * (0.7+(t_error[t_i]-t_mn)/(t_mx-t_mn)*1.2)};//Math.sqrt(t_error[t_i]/t_e) * 0.6
            var t_new = (Config.get("suggestion") == "New" && Config.get("focusType") == "Point"), t_context = Config.get("showContext");
            var t_errscale = d3.interpolate("#0BF","#FB0");//d3.scale.linear().domain([t_mn, t_mx]).range([0.1,1]);
            self.clearBrush(!this.ready);
            var t_clusters = Config.get("cluster"), t_dark = Config.get("lightColor").dark;
            if(!this.ready){
                var t_proj = [];
                var t_max = Math.max(Math.abs(tt_data.max), Math.abs(tt_data.min)), t_range = [-t_max, t_max];
                this.data_size = this.model.projection.length;
                this.changePanel("FocusInfo", this.data_size+" (100%)", true);
                this.scale.x.domain(t_range);
                this.scale.y.domain(t_range);
                t_scale = this.scale;
                var t_data = tt_data.data;
                //draw points
                var t_pts = this.d3el.append("g")
                .classed("vpProjectionPoints", true);
                var t_g = t_pts.selectAll(".vpProjectionPoint")
                .data(this.model.projection)
                .enter()
                .append("g")
                .attr("class","vpProjectionPoint")
                .attr("index", function(t_d, t_i){
                    return t_i;
                })
                .attr("id",function(t_d, t_i){
                    return "vpProjectionPoint_"+t_i;
                })
                .attr("transform",function(t_d, t_i){
                    var t_x = t_scale.x(t_d[0]), t_y = t_scale.y(t_d[1]);
                    t_proj[t_i] = [t_x, t_y];
                    return "translate(" + t_x + "," + t_y + ")";
                })
                .attr("error",function(t_d, t_i){
                    return t_error[t_i];
                })
                .style("opacity",self.focus_opc)
                .on("click",function(t_d){
                    var t_focus = Config.get("focusType");
                    if(!(t_focus == "Group" && Config.get("modification") != "None")){//changed
                        self.d3el.selectAll(".vpProjectionPoint").classed("groupMember",false);
                    }
                    if(t_focus == "Group"){
                        // var t_gon = Config.get("groupOn");
                        // Config.set("groupOn", !t_gon);
                        // self.groupOn = !t_gon;
                        // self.d3el.selectAll(".vpProjectionPoint").classed("groupCenter",false);
                        // d3.select(this).classed("groupCenter", !t_gon);
                        return;
                    }
                    var t_i = parseInt($(this).attr("index"));
                    self.focus = [t_i];
                    d3.select(this).classed("groupMember", true);
                    self.trigger("ViewpointView__updateProjection",{pos: null, id: t_i});
                })
                .attr("data-html", true)
                .attr("data-original-title", function(t_d, t_i){
                    var t_text = "";
                    self.model.dimensions.forEach(function(t_key, t_value){
                        t_text += t_value+": "+t_data[t_i][t_value]+"</br>";
                    });
                    return t_text;
                })
                .attr("data-placement", "bottom")
                .on("mouseover", function(){
                    var t_self = this;
                    clearTimeout(self.hover.timer);
                    self.hover.timer = setTimeout(function(){
                        $(t_self).tooltip("show");
                    }, self.hover.time);
                })
                .on("mouseout", function(){
                    clearTimeout(self.hover.timer);
                    self.hover.timer = null;
                    $(this).tooltip("hide");
                });
                $(t_g[0])
                .tooltip({
                    container: "#leftBottom",
                    trigger: "manual",
                });
                t_g.append("circle")
                .attr("cx",0)
                .attr("cy",0)
                .attr("color", function(t_d, t_i){
                    // var t_class = t_clusters[t_i];
                    // if(t_class)
                    //     return self.classColors(t_class);
                    // else
                    return t_dark;
                })
                .attr("radius", function(t_d, t_i){
                    return t_er_r(t_i);
                })
                .attr("r",function(t_d, t_i){
                    // var t_e = d3.select(".vpBefore #vpProjectionPoint_"+t_i).attr("error");
                    // t_e = parseFloat(t_e);
                    // return t_er_r(t_i);
                    // return self.point.r;
                    if(t_new){
                        return $(this).attr("radius");
                    }else{
                        return self.point.r;
                    }
                })
                .attr("fill", function(t_d, t_i){
                    return $(this).attr("color");
                })
                .attr("dataClass", function(t_d, t_i){
                    return t_clusters[t_i];
                });
                // .attr("fill",function(t_d, t_i){
                //     return t_errscale((t_error[t_i]-t_mn)/(t_mx - t_mn));
                // })
                // .attr("stroke",function(t_d, t_i){color
                //     return t_errscale((t_error[t_i]-t_mn)/(t_mx - t_mn));
                // });
                // t_g.append("title")
                // .text(function(t_d, t_i){
                //     var t_text = "";
                //     self.model.dimensions.forEach(function(t_key, t_value){
                //         t_text += t_value+": "+t_data[t_i][t_value]+"\n";
                //     });
                //     return t_text;
                // });
                // t_g.append("line")
                // .attr("x1", 0)
                // .attr("y1", 0)
                // .attr("x2", function(t_d, t_i){
                //     return tt_scale.x(t_vector[t_i][0]);
                // })
                // .attr("y2", function(t_d, t_i){
                //     return tt_scale.y(t_vector[t_i][1]);
                // })
                // .attr("stroke","#ccc")
                // .attr("opacity", this.drawLine?1:0);
                self.projection = t_proj;
                self.drawClusterSuggestion(true, t_proj);//draw clusters
                this.d3el.append("g")
                .attr("class","vpLantern")
                .style("opacity",0)
                .style("display","none")
                .append("circle")
                .attr("cx",0)
                .attr("cy",0)
                .attr("r", this.point.r)
                .attr("fill",this.light);
                //draw axes
                var t_axes = this.d3el.append("g")
                .classed("vpProjectionAxes", true);
                var t_axis = t_axes.selectAll(".vpProjectionAxis")
                .data(self.model.coordinates)
                .enter()
                .append("g")
                .attr("class", "vpProjectionAxis")
                .attr("id", function(t_d, t_i){
                    return "vpProjectionAxis_" + t_i;
                })
                t_axis.append("line")
                .attr("x1", t_scale.x(0))
                .attr("y1", t_scale.y(0))
                .attr("x2", function(t_d){ return t_scale.x(t_d[0] * t_max * t_shorter);})
                .attr("y2", function(t_d){ return t_scale.y(t_d[1] * t_max * t_shorter);});
                t_axis.append("text")
                .attr("tlength", function(t_d, t_i){
                    var t_text = t_dimensions[t_i];
                    var t_size = t_text.visualLength(self.model.fontSize);
                    return t_size.join(",");
                })
                .attr("x", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.x(t_d[0] * t_max * t_longer) - t_size[0] / 2;
                })
                .attr("y", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.y(t_d[1] * t_max * t_longer) + t_size[1] / 2;
                })
                .text(function(t_d, t_i){
                    return t_dimensions[t_i];
                });
                this.updateDimHistogram(t_dimensions, v_cord, self.transition.duration);
                this.showAxis();
                this.ready = true;
            }else{
                if(t_context){
                    self.d3el.selectAll(".vpProjectionPoint")
                    .classed("context", false);
                }else{
                    self.d3el.selectAll(".vpProjectionPoint")
                    .classed("context", !(self.focus.length == 0));
                }
                // if(self.focus.length == 0){
                    // this.d3el.selectAll(".vpProjectionPoint")
                    // .style("display", "block")
                    // .style("opacity", 1);
                // }
                var t_max = t_scale.x.domain();
                t_max = t_max[1];
                var t_frame = self.model.frames, t_last = (self.model.nowFrame == t_frame - 1), t_proj = [];
                var t_axes = this.d3el.selectAll(".vpProjectionAxis")
                .data(self.model.coordinates);
                t_axes.select("line")
                .transition()
                .ease("linear")
                .duration(self.transition.interval)
                .attr("x2", function(t_d){ return t_scale.x(t_d[0] * t_max * t_shorter);})
                .attr("y2", function(t_d){ return t_scale.y(t_d[1] * t_max * t_shorter);});
                t_axes.select("text")
                .attr("x", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.x(t_d[0] * t_max * t_longer) - t_size[0] / 2;
                })
                .attr("y", function(t_d){
                    var t_size = $(this).attr("tlength").split(",");
                    return t_scale.y(t_d[1] * t_max * t_longer) + t_size[1] / 2;
                });
                var t_projection = this.model.projection;
                this.d3el.selectAll(".vpProjectionPoint")
                .data(this.model.projection)
                .transition()
                .ease("linear")
                .duration(self.transition.interval)
                .attr("transform",function(t_d){
                    var t_i = parseInt($(this).attr("index"));
                    var t_x = t_scale.x(t_projection[t_i][0]), t_y = t_scale.y(t_projection[t_i][1]);
                    if(t_last){
                        t_proj[t_i] = [t_x, t_y];
                    }
                    return "translate("+t_x+","+t_y+")";
                });
                this.projection = t_proj;
                var t_change = self.point.rChange;
                if(v_start){
                    self.showAxis();
                    // var t_showAxis = Config.get("showAxis"), t_subspace = Config.get("subspace"), t_useSub = Config.get("useSubspace");
                    // if(t_showAxis){
                    //     t_axes.transition()
                    //     .duration(self.transition.duration)
                    //     .ease("linear")
                    //     .style("opacity", function(t_d, t_i){
                    //         if(t_useSub){
                    //             return t_subspace[t_i]?1:0;
                    //         }else{
                    //             return 1;
                    //         }
                    //     });
                    // }
                    t_change = [];
                    this.d3el.selectAll(".vpProjectionPoint")
                    .attr("error",function(t_d){
                        var t_i = parseInt($(this).attr("index"));
                        // var t_r = parseFloat(d3.select(this).select("circle").attr("r"));
                        t_change[t_i] = t_er_r(t_i);
                        return t_error[t_i];
                    });
                    this.d3el.selectAll(".vpProjectionPoints circle")
                    .attr("color", function(t_d){
                        // var t_i = parseInt($(this).parent("g").attr("index"));
                        // var t_class = t_clusters[t_i];
                        // if(t_class)
                        //     return self.classColors(t_class);
                        // else
                        return t_dark;
                    })
                    .attr("radius", function(){
                        var t_i = $(this).parent('g').attr("index");
                        return t_change[t_i];
                    })
                    .transition()
                    .duration(self.transition.duration)
                    .ease("linear")
                    .attr("r", function(){
                        if(t_new){
                            return $(this).attr("radius");
                        }else{
                            return self.point.r;
                        }
                    });
                    self.drawClusterSuggestion(false, null);
                    self.drawModifySuggestion(false, null);
                    self.point.rChange = t_change;
                    self.showFocus(true);
                    self.updateDimHistogram(t_dimensions, v_cord, self.transition.duration);
                }
                if(t_last){
                    setTimeout(function(){
                        self.drawClusterSuggestion(true, t_proj);//draw clusters
                        if(self.focus.length>1){
                            self.drawModifySuggestion(true, t_proj);
                        }
                    }, (self.transition.duration))
                }
                // this.d3el.selectAll(".vpProjectionPoint line")
                // .transition()
                // .ease("linear")
                // .duration(self.transition.interval)
                // .attr("x2", function(t_d, t_i){
                //     return tt_scale.x(t_vector[t_i][0]);
                // })
                // .attr("y2", function(t_d, t_i){
                //     return tt_scale.y(t_vector[t_i][1]);
                // });
                // this.d3el.selectAll(".vpProjectionPoint circle")
                // .transition()
                // .ease("linear")
                // .duration(self.transition.interval)
                // .attr("r",function(t_d, t_i){
                //     // var t_e = d3.select(".vpBefore #vpProjectionPoint_"+t_i).attr("error");
                //     // t_e = parseFloat(t_e);
                //     // var t_r = parseFloat(d3.select(this).attr("r"));
                //     // return t_r+t_change[t_i];
                //     return self.point.r;
                // })
            }
        },

        fixProjection: function(){
            var t_objs = d3.selectAll(".vpProjectionPoint")
            .filter(function(){
                return !(d3.select(this).classed("groupMember"));
            });
            t_objs = t_objs[0];
            $(".groupMember").insertAfter(t_objs[t_objs.length-1]);
        },

        bindInteractions: function(){
            var self = this, t_scale = this.scale, t_range = t_scale.x.range();
            var tc_scale = d3.interpolate("#000","#FB0");
            self.d3el
            .on("mousedown", function(){
                if(!self.groupOn)
                    return;
                var t_pos = d3.mouse(this);
                self.lasso.push(t_pos);
                self.lassoPath.push("M"+t_pos);
                d3.select(this).append("path")
                .attr("id","brushPath")
                .attr("d",self.lassoPath.join(" "));
            })
            .on("mousemove", function(){
                if(self.groupOn){
                    if(self.lasso.length != 0){
                        var t_pos = d3.mouse(this);
                        self.lasso.push(t_pos);
                        self.lassoPath.push("L"+t_pos);
                        d3.select(this).select("#brushPath")
                        .attr("d",self.lassoPath.join(" "));
                    }
                    return;
                }
                if(self.mouseOutChange){
                    Config.set("mouseOver", true);
                    // d3.selectAll(".groupFocus").classed("groupFocus", false);
                    // d3.selectAll(".groupContext").classed("groupContext", false);
                    self.mouseOutChange = false;
                }
                // if(!Config.get("lightingOn"))
                //     return;
                // d3.select(this).select(".vpLantern")
                // .style("opacity",0);
                var t_pos = d3.mouse(this);
                t_pos[0] = t_scale.x.invert(t_pos[0]);
                t_pos[1] = t_scale.y.invert(t_pos[1]);
                self.trigger("ViewpointView__Highlight", t_pos);
                /*Change Projection Dynamically*/
                // if(self.state == "before")
                //     self.trigger("ViewpointView__updateProjection", {pos: t_pos, id: null});
            })
            .on("mouseup", function(){
                if(!self.groupOn)
                    return;
                d3.selectAll("#brushPath")
                .transition()
                .duration(self.transition.duration)
                .attr("stroke-opacity",0)
                .remove();
                if(self.lasso.length<3){
                    self.clearBrush(false);
                    return;
                }
                self.getFocusGroup(self.lasso);
                self.confirmFocus();
                self.clearBrush(false);
            })
            .on("mouseout", function(){
                if(self.groupOn)
                    return;
                var t_pos = d3.mouse(this), t_scale = self.scale, t_ranges = {x: t_scale.x.range(), y: t_scale.y.range()};
                if(t_pos[0] > t_ranges.x[0] && t_pos[0] < t_ranges.x[1] && t_pos[1] > t_ranges.y[0] && t_pos[1] < t_ranges.y[1]){
                    t_pos[0] = t_scale.x.invert(t_pos[0]);
                    t_pos[1] = t_scale.y.invert(t_pos[1]);
                    self.trigger("ViewpointView__Highlight", t_pos);
                }else{
                    self.mouseOutChange = true;
                    Config.set("mouseOver", false);
                    self.trigger("ViewpointView__dimLights");
                }
            });
            // .on("click",function(){
            //     if(self.stopAction){
            //         self.stopAction = false;
            //         return;
            //     }
            //     var t_pos = d3.mouse(this);
            //     t_pos[0] = t_scale.x.invert(t_pos[0]);
            //     t_pos[1] = t_scale.y.invert(t_pos[1]);
            //     self.trigger("ViewpointView__updateProjection", {pos: t_pos, id: null});
            // });
        },

        getFocusGroup: function(v_brush){
            var self = this, t_brush = [], t_scale = this.scale;
            var t_projection = this.model.projection;
            var t_objs, tt_sign = false;
            if(Config.get("modification") != "None"){//changed
                if(Config.get("modification") == "Minus")
                    t_objs = this.d3el.selectAll(".groupMember");
                if(Config.get("modification") == "Add"){//changed
                    tt_sign = true;
                    t_objs = this.d3el.selectAll(".vpProjectionPoint");
                }
            }else{
                t_objs = this.d3el.selectAll(".vpProjectionPoint");
            }
            t_objs
            .each(function(d){
                var t_i = $(this).attr("index"), t_d = t_projection[t_i];
                var t_pos = [t_scale.x(t_d[0]), t_scale.y(t_d[1])];
                var t_sign = insidePolygon(v_brush, t_pos);
                if(tt_sign && d3.select(this).classed("groupMember")){
                    t_sign = true;
                }
                if(t_sign){
                    d3.select(this).classed("groupMember", true);
                    t_brush.push(t_i);
                }
            });
            self.focus = t_brush;
        },

        confirmFocus: function(){
            var self = this;
            if(self.focus.length>1){
                self.looseFocus();
                self.trigger("ViewpointView__updateProjectionByGroup", self.focus);
            }
            else{
                alert("ERROR: Please choose more than two data to form a group!");
                self.d3el.selectAll(".groupMember").classed("groupMember",false);
            }
        },

        changeContext: function(){
            var self = this, t_showContext = Config.get("showContext");
            if(self.focus.length > 0){
                self.d3el.selectAll(".vpProjectionPoint")
                .classed("context", !t_showContext);
                // var t_context = self.d3el.selectAll(".vpProjectionPoint")
                // .filter(function(d){
                //     return !d3.select(this).classed("groupMember");
                // });
                // if(!t_showContext){
                //     t_context
                //     .transition()
                //     .duration(self.transition.duration)
                //     .style("opacity", 0);
                //     setTimeout(function(){
                //         t_context.attr("display", "none");
                //     }, self.transition.duration);
                // }else{
                //     t_context.attr("display", "block");
                //     t_context
                //     .transition()
                //     .duration(self.transition.duration)
                //     .style("opacity", 1);
                // }
            }
        },

        clearBrush: function(v_clBrush){
            var self = this;
            self.lasso = [];
            self.lassoPath = [];
            // Config.set("groupOn", false);
            // self.groupOn = false;
            self.d3el.selectAll(".vpProjectionPoint").classed("groupCenter",false);
            if(v_clBrush)
                self.focus = [];
        },

        sortPoints: function(){
            var t_ord = this.model.order, self = this, t_d3 = this.d3el, t_el = this.$el;
            t_ord.forEach(function(t_ind){
                var t_node = t_d3.select("#vpProjectionPoint_"+t_ind).node();
                t_el.append(t_node);
            });
            var t_node = t_d3.select(".vpLantern").node();
            t_el.append(t_node);
        },

        changeOptimization: function(){
            var self = this;
            if(self.focus.length == 0){
                self.trigger("ViewpointView__updatePCA", Config.get("optimization"));
            }else{
                if(self.focus.length == 1){
                    self.trigger("ViewpointView__updateProjection", {pos: null, id: self.focus[0]});
                }else{
                    self.trigger("ViewpointView__updateProjectionByGroup", self.focus);
                }
            }
        },

        changeSubspace: function(v_dimCount){
            var self = this;
            var t_useSub = Config.get("useSubspace"), t_dimCount = isNaN(v_dimCount)?null:v_dimCount;
            self.changePanel("SubspaceInfo", (t_useSub?"On":"Off"));
            d3.select(".vpInfoPanel .extent").classed("shown", t_useSub);
            d3.selectAll(".vpInfoPanel .resize").classed("shown", t_useSub);
            self.dimBar.count = Config.get("data").dimensions.length;
            if(self.focus.length == 0){
                return;
            }else{
                self.model.getReady();
                if(self.focus.length == 1){
                    self.trigger("ViewpointView__updateProjection", {pos: null, id: self.focus[0]}, t_dimCount);
                }else{
                    self.trigger("ViewpointView__updateProjectionByGroup", self.focus, t_dimCount);
                }
            }
        },

        changeOptiInfo: function(){
            this.changePanel("ViewpointInfo", Config.get("optimization"));
        },

        showVector: function(){
            this.drawLine = Config.get("showVector");
            this.d3el.selectAll(".vpProjectionPoint line")
            .transition()
            .duration(this.transition.duration)
            .attr("opacity",this.drawLine?1:0);
        },

        showAxis: function(){
            var self = this;
            this.drawAxis = Config.get("showAxis");
            var t_useSub = Config.get("useSubspace"), t_subspace = Config.get("subspace");
            self.changePanel("AxesInfo", (this.drawAxis?"Shown":"Hidden"));
            this.d3el.selectAll(".vpProjectionAxis")
            .style("display", "block")
            .transition()
            .duration(this.transition.duration)
            .ease("linear")
            .style("opacity", function(t_d, t_i){
                if(!self.drawAxis)
                    return 0;
                if(t_useSub){
                    return t_subspace[t_i]?1:0;
                }else{
                    return 1;
                }
            });
            setTimeout(function(){
                if(!self.drawAxis){
                    self.d3el.selectAll(".vpProjectionAxis")
                    .style("display", "none");
                }else{
                    self.d3el.selectAll(".vpProjectionAxis")
                    .style("display", function(t_d, t_i){
                        if(t_useSub){
                            return t_subspace[t_i]?"block":"none";
                        }else{
                            return "block";
                        }
                    });
                }
            }, (self.transition.duration + 100));
        },

        initInfoPanel: function(){
            var self = this, t_infoIcon = $(".hiddenIcon#InfoIcon").get(0).innerHTML;
            d3.selectAll(".vpInfoContainer").remove();
            var t_type = Config.get("optimization");
            var t_info = d3.select(self.parent)
            .append("div")
            .classed("vpInfoContainer", true);
            var t_btn = t_info.append("button")
            .attr("class","btn btn-xs btn-default")
            .attr("id", "vpInfoBtn")
            .on("click", function(){
                self.toggleInfoPanel();
            });
            t_btn
            .append("i")
            .attr("class","iconfont")
            .text(t_infoIcon);
            var t_panel = t_info.append("div")
            .attr("class","vpInfoPanel");
            var t_sug = Config.get("suggestion"), t_sugInfo = (t_sug?(t_sug == "New"?"On":"Modify"):"Off");
            self.addPanel(t_panel, "DataInfo", "Data: ", Config.get("currentData"));//Data Info
            self.addPanel(t_panel, "ViewpointInfo", "Viewpoint: ", t_type);//Viewpoint Info
            self.addPanel(t_panel, "SelectionInfo", "Focus: ", Config.get("focusType"));//Focus Info
            self.addPanel(t_panel, "SuggestionInfo", "Suggestion: ", t_sugInfo);//Focus Info
            self.addPanel(t_panel, "AxesInfo", "Axes: ", Config.get("showAxis")?"Shown":"Hidden");//Axes Info
            self.addPanel(t_panel, "SubspaceInfo", "Subspace: ", (Config.get("useSubspace")?"On":"Off"));//Subspace Info
            self.addPanel(t_panel, "FocusInfo", "Focus: ", self.data_size);//Focus Info
            self.addPanel(t_panel, "EntropyInfo", "Entropy: ", "null");//Entropy Info
            self.addPanel(t_panel, "DimensionWeights", "Dimension weights:", "");//Dimension Histogram
            self.renderHistogram(t_panel);
            self.info = t_info;
        },

        addPanel: function(v_g, v_id, v_header, v_content){
            var t_g = v_g.append("div")
            .data([v_content])
            .attr("id", v_id);
            t_g.append("span")
            .attr("class", "bold")
            .text(v_header);
            t_g.append("span")
            .attr("class", "text")
            .text(v_content);
        },

        changePanel: function(v_id, v_content, v_remember){
            d3.select("#"+v_id+" .text")
            .text(v_content);
            if(v_remember){
                d3.select("#"+v_id+" .text")
                .data([v_content]);
            }
        },

        restoreInfoPanel: function(v_panels){
            for(var i in v_panels){
                d3.select("#"+v_panels[i]+" .text")
                .text(function(t_d){
                    return t_d;
                });
            }
        },

        renderHistogram: function(v_g){
            var t_padding = parseFloat($(".vpInfoPanel").css("padding").split(" ")[1]),
            t_width = parseFloat($(".vpInfoPanel").css("width")), self =this;
            var t_innerWidth = t_width - 2 * self.dimBar.ovlLeft;
            var t_height = self.dimBar.ovlHeight;
            var t_bar = v_g.append("svg")
            .attr("id","dimensionHistogram")
            .attr("width", t_innerWidth)
            .attr("height", t_height)
            .append("g");
            var t_dimensions = Config.get("data").dimensions.values(), t_num = t_dimensions.length,
            t_barWidth = (t_innerWidth - self.dimBar.innerLeft * 2) / t_num;
            self.dimBar.width = t_barWidth * 0.9;
            self.dimBar.height = self.dimBar.histoHeight;
            self.dimBar.left = t_barWidth * 0.05;
            self.dimBar.top = t_height * 0.05;
            self.dimBar.count = t_num;
            var t_position = [];
            var t_numbers = [], t_pos = [];
            for(var i = 0; i <= t_num; i++){
                if(i != t_num){
                    t_pos[i] = t_position[i] = self.dimBar.innerLeft * 0.5 + t_barWidth * i;
                }else{
                    t_pos[i] = t_position[t_num - 1] + t_barWidth;
                }
                t_numbers.push(i);
            }
            var t_brushScale = self.dimBar.scale = d3.scale.linear().domain(t_numbers).range(t_pos);
            var t_brush = self.dimBar.brush = d3.svg.brush()
            .x(t_brushScale)
            .extent([0, t_num])
            .on("brush", function(){
                var s = d3.event.target.extent();
                var t = Math.round(s[1]);
                if(self.focus.length == 0){
                    t = t_num;
                }else{
                    if(t < 2){
                        t = 2;
                    }
                }
                t_brush.extent([0, t]);
                t_bar.call(t_brush);
                self.dimBar.brushed = t;
            })
            .on("brushend", function(){
                var t = self.dimBar.brushed;
                if(self.dimBar.count != t){
                    self.dimBar.count = t;
                    self.changeSubspace(t);
                }
            });
            t_bar.call(t_brush)
            .selectAll(".extent")
            .attr("x", self.dimBar.innerLeft * 0.5)
            .attr("y", self.dimBar.top - 2.5)
            .attr("height", self.dimBar.height + 4);
            t_bar.selectAll(".resize rect")
            .attr("y", self.dimBar.top - 2.5)
            .attr("height", self.dimBar.height + 4);
            for(var i = 0; i < t_num; i++){
                var t_g = t_bar.append("g")
                .attr("transform", "translate("+t_position[i]+",0)")
                .attr("class", "dimBar")
                .attr("id", "dimBar_"+i);
                t_g.append("rect")
                .attr("x", self.dimBar.left)
                .attr("y", self.dimBar.top)
                .attr("width", self.dimBar.width)
                .attr("height", self.dimBar.height);
                var t_text = t_dimensions[i].length > self.dimBar.maxLength? (t_dimensions[i].slice(0,self.dimBar.maxLength)+"..."): t_dimensions[i];
                var t_textg = t_g.append("g")
                .attr("class", "dimText")
                .attr("text", t_dimensions[i])
                .attr("transform", "translate("+[self.dimBar.left + self.dimBar.width * 0.4, self.dimBar.top + self.dimBar.height + 10]+")");
                t_textg
                .append("text")
                .attr("class", "shortText")
                .attr("x", 0)
                .attr("y", 0)
                .attr("transform", "rotate("+self.dimBar.angle+")")
                .text(t_text);
                t_textg
                .append("text")
                .attr("class", "longText")
                .attr("x", 0)
                .attr("y", 0)
                .attr("transform", "rotate("+self.dimBar.angle+")")
                .text(t_dimensions[i]);
            }
            // .attr("width", t_barWidth * t_num);
            self.dimBar.position = t_position;
    // var xScale = d3.scale.ordinal().rangeRoundBands([t_width * 0.1, t_width * 0.9], 0.1);
    // xScale.domain(t_dimensions);
    // var yScale = d3.scale.linear()
    // .domain([0, 1])
    // .range([t_height * 0.9, t_height * 0.1]);
    // var xAxis = d3.svg.axis()
    // .scale(xScale)
    // .orient('bottom');
    // var yAxis = d3.svg.axis()
    // .scale(yScale)
    // .orient('left');
    // t_bar.append("g")
    // .attr("class", "xAxis")
    // .attr("transform", "translate(0," + t_height * 0.9 + ")")
    // .call(xAxis);
    // t_bar.append("g")
    // .attr("class", "yAxis")
    // .call(yAxis);
},

restoreDimHistogram: function(v_duration){
    d3.selectAll(".dimBar rect")
    .interrupt()
    .transition()
    .duration(v_duration)
    .attr("y", function(t_d){
        return parseFloat(t_d.y);
    })
    .attr("height", function(t_d){
        return parseFloat(t_d.height);
    });
},

updateDimHistogram: function(v_dim, v_cord, v_duration){
    var self = this, t_bar = d3.select(".vpInfoPanel #dimensionHistogram"), t_dimBar = self.dimBar, t_position = t_dimBar.position;
    var t_dims = [];
    for(var i in v_cord){
        var t_score = numeric.norm2Squared(v_cord[i]) / 2;
        t_dims.push({
            length: t_score,
            order: i,});
    }
    var t_length = _.map(t_dims, 'length');
    self.updateEntropy(t_length);
    var t_count = 0;
    for(var i in t_dims){
        if(t_dims[i].length < 1e-15){
            t_length[i] = 0;
            t_dims[i].length = 0;
        }else{
            t_count ++;
        }
    }
    var t_brush = self.dimBar.brush, t_brushScale = self.dimBar.scale;
    self.dimBar.count = t_count;
    t_brush.extent([0, t_count]);
    d3.select(".vpInfoPanel .extent")
    .transition()
    .ease("linear")
    .duration(v_duration)
    .attr("width", t_brushScale(t_count) - t_brushScale(0));
    setTimeout(function () {
        d3.select("#dimensionHistogram g")
        .call(t_brush);
    });
    t_dims.sort(function(a,b){return b.length - a.length;});
    var t_indeces = _.map(t_dims, 'order');
    var t_scale = d3.scale.linear().range([0, t_dimBar.height]).domain([0, d3.max(t_length)]);
    for(var i in v_dim){
        var t_height = t_scale(t_length[i]);
        var t_y = t_dimBar.top + t_dimBar.height - t_height;
        t_bar.select("#dimBar_"+i+" rect")
        .data([{y: t_y.toPrecision(5), height: t_height.toPrecision(5),}])
        .transition()
        .duration(v_duration)
        .ease("linear")
        .attr("y", t_y)
        .attr("height", t_height);
        var t_index = t_indeces.indexOf(i);
        t_bar.select("#dimBar_"+i)
        .transition()
        .delay(v_duration * 1.8)
        .duration(v_duration)
        .ease("linear")
        .attr("transform", "translate("+t_position[t_index]+",0)");
        $("#dimBar_"+i+" rect").tooltip("destroy");
        $("#dimBar_"+i+" text").tooltip("destroy");
    }
    setTimeout(function(){
        for(var i in v_dim){
            $("#dimBar_"+i+" rect")
            .attr("title", v_dim[i]+": "+(t_length[i].toPrecision(3)))
            .attr("data-placement", "right")
            .tooltip({
                container: "#leftBottom"
            });
            $("#dimBar_"+i+" text")
            .attr("title", v_dim[i]+": "+(t_length[i].toPrecision(3)))
            .attr("data-placement", "left")
            .tooltip({
                container: "#leftBottom"
            });
        }
    }, v_duration * 3);
},

changeFocusType: function(){
    var t_type = Config.get("focusType");
    this.groupOn = (t_type == "Group");
    Config.set("groupOn", this.groupOn);
    this.changePanel("SelectionInfo", t_type);
    this.changeSuggestion(t_type, Config.get("suggestion"));
},

changeData: function(){
    var t_data = Config.get("currentData");
    this.changePanel("DataInfo", t_data);
},

updateEntropy: function(v_data){
    var t_entropy = 0, t_log = Math.log(2), t_all = Math.log(v_data.length) / t_log;
    for(var i in v_data){
        if(v_data[i] < 1e-15){
            continue;
        }
        t_entropy += - v_data[i] * Math.log(v_data[i]) / t_log;
    }
    // t_entropy = t_entropy / t_all;
    this.changePanel("EntropyInfo", t_entropy.toPrecision(3)+" (1.00 to "+t_all.toPrecision(3)+")", true);//(t_entropy * 100).toPrecision(3)
},

toggleInfoPanel: function(){
    var self = this;
    $(".vpInfoPanel").slideToggle(300);
    self.infoToggle = !self.infoToggle;
},

toggleSuggestion: function(v_sign){
    var self = this, t_sug = Config.get("suggestion"), t_modi = Config.get("modification");
    var t_sugInfo;
    if(t_sug){
        t_sugInfo = self.suggestion.info[t_sug];
        if(t_modi != "None"){
            var t_modInfo = self.suggestion.modiInfo[t_modi];
            t_sugInfo += " ("+t_modInfo+")";
        }
    }else{
        t_sugInfo = "Off";
    }
    self.changePanel("SuggestionInfo", t_sugInfo);
    self.changeSuggestion(Config.get("focusType"), t_sug, t_modi);
},

changeSuggestion: function(v_type, v_sug, v_modi){
    var self = this;
    self.changePointRadius(v_sug == "New" && v_type == "Point");
    self.changeGroupPath(v_sug == "New" && v_type == "Group");
    // self.changeGroupModify(v_sug == "Old" && v_type == "Group" && v_modi == "Add", "Add");//changed
    // self.changeGroupModify(v_sug == "Old" && v_type == "Group" && v_modi == "Minus", "Minus");//changed
    // if(v_sug){
    //     if(v_sug == "New"){
    //         if(v_type == "Point"){
    //             self.changePointRadius(true);
    //             self.changeGroupPath(false);
    //             self.changeGroupModify(false);
    //         }else{
    //             self.changePointRadius(false);
    //             self.changeGroupPath(true);
    //             self.changeGroupModify(false);
    //         }
    //     }else{//Revise Suggestion
    //         self.changePointRadius(false);
    //         self.changeGroupPath(false);
    //         if(v_type != "Point"){
    //             self.changeGroupModify(true);
    //             //Revise Suggestion for Clusters
    //         }
    //     }
    // }else{
    //     self.changePointRadius(false);//Cancel new point suggestion
    //     self.changeGroupPath(false);//Cancel new cluster suggestion
    //     self.changeGroupModify(false);
    // }
},

changePointRadius: function(v_sign){
    var self = this, t_r = self.point.r;
    if(self.suggestion.newpoint != v_sign){
        self.suggestion.newpoint = v_sign;
        self.d3el.selectAll(".vpProjectionPoints circle")
        .transition()
        .duration(self.transition.duration)
        .ease("linear")
        .attr("r", function(){
            if(v_sign)
                return $(this).attr("radius");
            else
                return t_r;
        });
    }
},

changeGroupPath: function(v_sign){
    var self = this, t_r = self.point.r;
    if(self.suggestion.newgroup != v_sign){
        self.suggestion.newgroup = v_sign;
        if(v_sign){
            self.d3el.selectAll(".convexHull path")
            .style("display", "block")
            .transition()
            .duration(self.transition.duration)
            .ease("linear")
            .style("opacity", self.opacityDark);
        }else{
            self.d3el.selectAll(".convexHull path")
            .transition()
            .duration(self.transition.duration)
            .ease("linear")
            .style("opacity", 0);
            setTimeout(function(){
                self.d3el.selectAll(".convexHull path")
                .style("display", "none");
            }, self.transition.duration + 100);
        }
    }
},

changeGroupModify: function(v_sign, v_modi){
    var self = this, t_r = self.point.r;
    if(self.suggestion.oldgroup[v_modi] != v_sign){
        self.suggestion.oldgroup[v_modi] = v_sign;
        if(v_sign){
            self.d3el.selectAll(".modifyHull path")
            .filter(function(){
                return $(this).attr("type") == v_modi;
            })
            .style("display", "block")
            .transition()
            .duration(self.transition.duration)
            .ease("linear")
            .style("opacity", self.opacityDark);
        }else{
            self.d3el.selectAll(".modifyHull path")
            .filter(function(){
                return $(this).attr("type") == v_modi;
            })
            .transition()
            .duration(self.transition.duration)
            .ease("linear")
            .style("opacity", 0);
            setTimeout(function(){
                self.d3el.selectAll(".modifyHull path")
                .filter(function(){
                    return $(this).attr("type") == v_modi;
                })
                .style("display", "none");
            }, self.transition.duration + 100);
        }
    }
},

drawClusterSuggestion: function(v_sign, v_data){
    var self = this;
    self.clusterShown = v_sign;
    if(v_sign){
        var t_clusters = self.model.clusters;
        for(var i in t_clusters){
            var t_data = [], t_indeces = t_clusters[i], t_center = [0, 0];
            for(var j in t_indeces){
                var t_d = v_data[t_indeces[j]];
                t_center[0] += t_d[0];
                t_center[1] += t_d[1];
                t_data.push(t_d);
            }
            t_center[0] = t_center[0] / t_indeces.length;
            t_center[1] = t_center[1] / t_indeces.length;
            var t_hullPoints = self.getPath(t_data, t_center, self.point.r), t_path = "";
            var t_hull = self.d3el.selectAll(".nothing")
            .data([t_indeces])
            .enter()
            .append("g")
            .attr("class", "convexHull")
            .attr("index", i)
            .on("click", function(t_d){
                var t_group = [];
                for(var i in t_d){
                    t_group.push(t_d[i]+"");
                }
                self.focus = t_group;
                self.confirmFocus();
            })
            .attr("mouseover", "None");
            for(var i in t_hullPoints){
                if(i == 0){
                    t_path += "M"+t_hullPoints[0];
                }else{
                    t_path += " L"+t_hullPoints[i];
                }
            }
            var t_svgPath =
            t_hull.append("path")
            .attr("d", t_path)
            .attr("class", "suggestionPath")
            .style("opacity", 0)
            .style("display", "none");
            if(Config.get("suggestion") == "New" && Config.get("focusType") == "Group"){
                t_svgPath
                .style("display", "block")
                .transition()
                .duration(self.transition.duration)
                .style("opacity", self.opacityDark);
            }
            if(self.clusterInfo){
                self.showClusterInfo(t_hull);
            }
        }
        self.clusterInfo = false;
    }else{
        self.d3el.selectAll(".convexHull")
        .transition()
        .duration(self.transition.duration)
        .style("opacity", 0)
        .remove();
    }
},

updateModify: function(){
    var self = this;
    self.drawModifySuggestion(false, null);
    setTimeout(function(){
        self.drawModifySuggestion(true, self.projection);
    }, (self.transition.duration));
},

drawModifySuggestion: function(v_sign, v_data){
    var self = this;
    if(v_sign){
        var t_modifies = self.model.modifies;
        for(var t_i in t_modifies){
            var t_clusters = t_modifies[t_i];
            for(var i in t_clusters){
                var t_data = [], t_indeces = t_clusters[i], t_center = [0, 0];
                for(var j in t_indeces){
                    var t_d = v_data[t_indeces[j]];
                    t_center[0] += t_d[0];
                    t_center[1] += t_d[1];
                    t_data.push(t_d);
                }
                t_center[0] = t_center[0] / t_indeces.length;
                t_center[1] = t_center[1] / t_indeces.length;
                var t_hullPoints = self.getPath(t_data, t_center, self.point.r), t_path = "";
                var t_hull = self.d3el.selectAll(".nothing")
                .data([t_indeces])
                .enter()
                .append("g")
                .attr("class", "modifyHull")
                .attr("index", i)
                .on("click", function(t_d){
                    var t_group = [];
                    for(var i in t_d){
                        t_group.push(t_d[i]+"");
                    }
                    self.focus = t_group;
                    self.confirmFocus();
                })
                .attr("mouseover", "None");
                for(var i in t_hullPoints){
                    if(i == 0){
                        t_path += "M"+t_hullPoints[0];
                    }else{
                        t_path += " L"+t_hullPoints[i];
                    }
                }
                var t_svgPath =
                t_hull.append("path")
                .attr("d", t_path)
                .attr("class", "suggestionPath")
                .attr("type", t_i)
                .style("opacity", 0)
                .style("display", "none");
                //if(Config.get("suggestion") == "Old" && Config.get("focusType") == "Group" && Config.get("modification") == t_i){//changed
                if(false){
                    t_svgPath
                    .style("display", "block")
                    .transition()
                    .duration(self.transition.duration)
                    .style("opacity", self.opacityDark);
                }
                if(self.modifyInfo){
                    self.showModifyInfo(t_hull, t_i);
                }
            }
        }
        self.modifyInfo = false;
    }else{
        self.d3el.selectAll(".modifyHull")
        .transition()
        .duration(self.transition.duration)
        .style("opacity", 0)
        .remove();
    }
},

getPath: function(v_data, v_center, v_r){
    if(false){
        var v_points = Hull(v_data, 120);
        var t_points = [], t_sum = 0;
        for(var i in v_points){
            var t_p = v_points[i], t_dx = t_p[0] - v_center[0], t_dy = t_p[1] - v_center[1];
            var t_x = Math.abs(t_dx);
            var t_y = Math.abs(t_dy);
            var t_l = Math.sqrt(t_x * t_x + t_y * t_y);
            t_sum += t_l;
            if(t_l < 1e-15){
                t_points[i] = t_p;
            }else{
                t_points[i] = [t_p[0] + t_dx * v_r / t_l, t_p[1] + t_dy * v_r / t_l];
            }
        }
        if(t_sum < 1e-10){
            var t_PI = Math.PI;
            t_points = [];
            for(var i = 0; i <= 12; i++){
                var t_ang = 2 * t_PI * i / 12, t_r = this.point.r + v_r;
                t_points[i] = [v_center[0] + Math.cos(t_ang) * t_r, v_center[1] + Math.sin(t_ang) * t_r];
            }
        }
    }else{
        var t_data = [], t_PI = 2 * Math.PI / 8, t_R = this.point.r + v_r;
        for(var j = 0; j < 8; j++){
            var t_ang = t_PI * j;
            for(var i in v_data){
                var t_p = [];
                t_p[0] = v_data[i][0] +Math.cos(t_ang) * t_R;
                t_p[1] = v_data[i][1] + Math.sin(t_ang) * t_R;
                t_data.push(t_p);
            }
        }
        var t_points = Hull(t_data, 120);
    }
    return t_points;
},

getClusterCord: function(v_clusters){
    this.trigger("ViewpointView__GetClusterCord", v_clusters);
},

getModifyCord: function(v_clusters, v_type){
    this.trigger("ViewpointView__GetModifyCord", v_clusters, v_type);
},

updateClusterInfo: function(){
    var self = this, t_objs = self.d3el.selectAll(".convexHull");
    if(!t_objs.empty() && t_objs.attr("mouseover") == "None"){
        self.showClusterInfo(t_objs);
    }else{
        self.clusterInfo = true;
    }
},

updateModifyInfo: function(){
    var self = this, t_objs = self.d3el.selectAll(".modifyHull");
    if(!t_objs.empty() && t_objs.attr("mouseover") == "None"){
        self.showModifyInfo(t_objs, "Add");
        self.showModifyInfo(t_objs, "Minus");
    }else{
        self.modifyInfo = true;
    }
},

showClusterInfo: function(t_g){
    var self = this, t_clusterCords = this.model.clusterCords, t_dimBar = self.dimBar,
    t_bar = d3.select(".vpInfoPanel #dimensionHistogram");
    t_g.on("mouseover", function(t_d){
        var t_i = parseInt($(this).attr("index")), t_cord = t_clusterCords[t_i];
        var t_scale = d3.scale.linear().range([0, t_dimBar.height]).domain([0, d3.max(t_cord)]);
        for(var i in t_cord){
            var t_height = t_scale(t_cord[i]);
            var t_y = t_dimBar.top + t_dimBar.height - t_height;
            t_bar.select("#dimBar_"+i+" rect")
            .interrupt()
            .transition()
            .duration(self.transition.duration)
            .attr("y", t_y.toPrecision(5))
            .attr("height", t_height.toPrecision(5));
        }
        var t_proportion = parseFloat(( t_d.length/ self.data_size * 100).toPrecision(3));
        var t_entropy = 0, t_log = Math.log(2), t_all = Math.log(t_cord.length) / t_log;
        for(var i in t_cord){
            if(t_cord[i] < 1e-15){
                continue;
            }
            t_entropy += - t_cord[i] * Math.log(t_cord[i]) / t_log;
        }
        // t_entropy = t_entropy / t_all;
        self.changePanel("FocusInfo", t_d.length+" ("+t_proportion+"%)");
        self.changePanel("EntropyInfo", t_entropy.toPrecision(3)+" (1.00 to "+t_all.toPrecision(3)+")");//(t_entropy * 100).toPrecision(3)
    })
    .on("mouseout", function(){
        self.restoreDimHistogram(self.transition.duration);
        self.restoreInfoPanel(["FocusInfo", "EntropyInfo"]);
    });
    self.d3el.selectAll(".convexHull").attr("mouseover", "Something");
},

showModifyInfo: function(v_g, v_modi){
    var self = this, t_clusterCords = this.model.modifyCords[v_modi], t_dimBar = self.dimBar,
    t_bar = d3.select(".vpInfoPanel #dimensionHistogram");
    v_g.on("mouseover", function(t_d){
        var t_i = parseInt($(this).attr("index")), t_cord = t_clusterCords[t_i];
        var t_scale = d3.scale.linear().range([0, t_dimBar.height]).domain([0, d3.max(t_cord)]);
        for(var i in t_cord){
            var t_height = t_scale(t_cord[i]);
            var t_y = t_dimBar.top + t_dimBar.height - t_height;
            t_bar.select("#dimBar_"+i+" rect")
            .interrupt()
            .transition()
            .duration(self.transition.duration)
            .attr("y", t_y.toPrecision(5))
            .attr("height", t_height.toPrecision(5));
        }
        var t_proportion = parseFloat(( t_d.length/ self.data_size * 100).toPrecision(3));
        var t_entropy = 0, t_log = Math.log(2), t_all = Math.log(t_cord.length) / t_log;
        for(var i in t_cord){
            if(t_cord[i] < 1e-15){
                continue;
            }
            t_entropy += - t_cord[i] * Math.log(t_cord[i]) / t_log;
        }
        // t_entropy = t_entropy / t_all;
        self.changePanel("FocusInfo", t_d.length+" ("+t_proportion+"%)");
        self.changePanel("EntropyInfo", t_entropy.toPrecision(3)+" (1.00 to "+t_all.toPrecision(3)+")");//(t_entropy * 100).toPrecision(3)
    })
    .on("mouseout", function(){
        self.restoreDimHistogram(self.transition.duration);
        self.restoreInfoPanel(["FocusInfo", "EntropyInfo"]);
    });
    self.d3el.selectAll(".modifyHull").attr("mouseover", "Something");
},

looseFocus: function(){
    Datacenter.releaseFocus();
    this.d3el.selectAll(".vpProjectionPoints circle")
    .attr("color", Config.get("lightColor").dark);
}
}, Base));

return ViewpointView;
});
