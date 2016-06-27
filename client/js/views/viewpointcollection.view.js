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
    'Base',
    'ViewpointView',
    ], function(require, Mn, _, $, Backbone, Datacenter, Config, Base, ViewpointView) {
        'use strict';
        var ViewpointCollection = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            childView: ViewpointView,

            childEvents: {
                "ViewpointView__getProjection":"getProjection",
                "ViewpointView__updateProjection": "updateProjection",
                "ViewpointView__updateProjectionByGroup": "updateProjectionByGroup",
                "ViewpointView__updatePCA": "updatePCA",
                "ViewpointView__Highlight": "setLights",
                "ViewpointView__dimLights": "dimLights",
                "ViewpointView__AddViewpoint": "addVPonMap",
                "ViewpointView__GetClusterCord": "getClusterCord",
                "ViewpointView__GetModifyCord": "getModifyCord",
                "ViewpointCollection__UpdateData": "updateData",
            },

            childViewOptions: {
                layout: null,
            },

            initialize: function (options) {
                var self = this;
                options = options || {};
                this.light = {
                    alpha: 4,
                    beta: 5,
                    light: Config.get("lightColor").light,
                    median: Config.get("lightColor").median,
                    dark: Config.get("lightColor").dark,
                    opcLow: 0.8,
                    opcHigh: 1.0,
                }
                this.transition = Config.get("transition");
                this.layout = Config.get("viewpointsLayout");
                this.childViewOptions.transition = this.transition;
                this.childViewOptions.light = this.light.light;
                this.bindAll();
            },

            bindAll: function(){
                this.listenTo(this.collection, "ViewpointCollection__AddViewpoint", this.addViewpoint);
                this.listenTo(this.collection, "ViewpointCollection__FocusUpdated", this.changeFocus);
                this.listenTo(this.collection, "ViewpointCollection__GetDistances", this.getVCDistances);
                this.listenTo(this.collection, "ViewpointCollection__ClearAll", this.clearAll);
                this.listenTo(this.collection, "ViewpointCollection__GetPosition", this.getPosition);
                this.listenTo(this.collection, "ViewpointCollection__updateProjectionByGroup", this.updateProjectionByGroup);
                this.listenTo(this.collection, "ViewpointCollection__highlight", this.highlightData);
                this.listenTo(this.collection, "ViewpointCollection_changeDataColor", this.changeDataColor);
                this.listenTo(Config, "change:lightingOn", this.changeColors);
            },

            addViewpoint: function(v_viewpoint){
                console.info("ViewpointCollectionView: viewpoint ready!");
            // this.showChildView(new ViewpointView({model: v_viewpoint}));
        },

        addVPonMap: function(v_child){
            var t_model = v_child.model;
            Datacenter.addFocus(t_model.focus, t_model.coordinates, t_model.optimization);
        },

        onShow: function(){
            var self = this;
        },

        changeFocus: function(){
        },

        getProjection: function(v_child){
            var t_model = v_child.model;
            this.collection.getProjection(t_model.id, t_model.coordinates);
        },

        getPosition: function(v_id){
            var t_top, t_left, t_size, t_count = this.collection.shownArray.length + 1;
            t_size = Math.min(this.layout.width * (1 - (t_count+1)*this.layout.marginRatio) / t_count, this.layout.height * (1 - 2*this.layout.topRatio));
            t_top = (this.layout.height - t_size) / 2;
            t_left = (this.layout.width - t_size*t_count) / (t_count+1);
            t_left = t_left * (v_id + 1)+ t_size* v_id;
            this.collection.getPosition({top: t_top, left: t_left, size: t_size, width: this.layout.width, height: this.layout.height});
        },

        updateProjection: function(v_child, v_opt, v_dimCount){
            var t_data, t_id = v_opt.id, t_pos = v_opt.pos;
            if(t_id){
                t_data = this.collection.data[t_id];
            }else{
                t_data = this.getViewpoint(v_child, t_pos);
            }
            this.collection.updateVPID = v_child.id;
            console.info("ViewpointCollectionView: Focus: "+[t_id]);
            Datacenter.updateCoordinates([t_id+''], v_dimCount);
        },

        updateProjectionByGroup: function(v_child, v_inds, v_dimCount){
            if(v_inds.length == 0){
                this.updatePCA(v_child, Config.get("optimization"));
                return;
            }
            var t_data = this.collection.data, t_focus = [];
            for(var i in v_inds){
                var t_i = v_inds[i];
                t_focus.push(t_data[t_i]);
            }
            this.collection.updateVPID = v_child.id;
            console.info("ViewpointCollectionView: " +  (v_inds.length>0?("Focus: "+v_inds):"PCA"));
            Datacenter.updateCoordinates(v_inds, v_dimCount);
        },

        highlight: function(v_viewpoint){
            var self = this, t_duration = this.transition.duration;
            if(v_viewpoint){
                var t_data = this.collection.data,t_a = this.light.alpha, t_b = this.light.beta;
                var tc_scale = d3.interpolateHsl(this.light.light, this.light.dark), to_scale = d3.interpolate(this.light.opcLow, this.light.opcHigh);
                var t_vps = d3.selectAll(".vpShown"), t_er = d3.select("#Viewmap");
                t_vps.selectAll(".vpProjectionPoint")
                .attr("x", function(t_d){
                    var t_i = parseInt($(this).attr("index"));
                    var tt_d = Math.sqrt(numeric.norm2(numeric.sub(t_data[t_i], v_viewpoint)))  ;//Math.sqrt()
                    var t_score = Math.min(1/(0.01+t_a*tt_d+t_b*tt_d*tt_d),1);
                    var t_col = tc_scale(t_score), t_opc = to_scale(t_score);
                    var tt_g = d3.select(this)
                    .style("opacity",t_opc)
                    .select("circle")
                    // .interrupt()
                    // .transition()
                    // .duration(self.transition.duration)
                    .attr("fill", function(){
                        var tt_col = d3.interpolateHsl(self.light.light, $(this).attr("color"));
                        return tt_col(t_score);
                    });
                    // t_er.select("#vpMapPoint_"+t_i+" circle")
                    // .attr("fill",t_col)
                    // .attr("opacity",t_opc);
                });
}else{
    var t_opc = this.light.opcHigh, t_dark = this.light.dark, t_light = this.light.median, t_over = Config.get("mouseOver");
    var t_members = self.d3el.selectAll(".groupMember");
    d3.selectAll(".vpShown .vpProjectionPoint")
    .transition()
    .duration(t_duration)
    .style("opacity", t_opc);
    if(!t_over){
        if(!t_members.empty()){
            self.d3el.selectAll(".vpProjectionPoint circle")
            .transition()
            .duration(self.transition.duration)
            .attr("fill", function(){
                var tt_col = d3.interpolateHsl(self.light.light, $(this).attr("color"));
                return tt_col(0.2);
                        });//t_light);
self.d3el.selectAll(".groupMember circle")
.interrupt()
.transition()
.duration(self.transition.duration)
.attr("fill", function(){
    return $(this).attr("color");
                        });//t_dark
}else{
    self.d3el.selectAll(".vpProjectionPoint circle")
    .transition()
    .duration(self.transition.duration)
    .attr("fill", function(){
        return $(this).attr("color");
                        });//t_dark
}
}
                // .transition()
                // .duration(t_duration)
                // .attr("fill", t_dark);
                // d3.selectAll(".vpMapPoint circle")
                // .transition()
                // .duration(t_duration)
                // .attr("fill", t_col)
                // .attr("opacity", t_opc);
                d3.selectAll(".vpLantern")
                .transition()
                .duration(t_duration)
                .style("opacity",0);
            }
        },

        changeColors: function(){
            if(!Config.get("lightingOn")){
                this.highlight(false);
            }
        },

        getVCDistances: function(v_vp){
            // this.collection.viewpoint = v_vp;
            this.highlight(v_vp);
        },

        setLights: function(v_child, v_pos){
            var self = this;
            var t_collection = self.collection;
            var t_viewpoint = self.getViewpoint(v_child, v_pos);
            // t_collection.viewpoint = t_viewpoint;
            this.highlight(t_viewpoint);
            var tt_pos, t_cord, t_scale = v_child.scale, t_model;
            for(var i = 0; i < t_collection.count; i++){
                var t_vp = d3.select("#ViewpointView_"+i);
                if(!t_vp.classed("vpShown"))
                    continue;
                t_model = t_collection.get(i);
                t_cord = t_model.coordinates;
                tt_pos = numeric.dot(t_viewpoint, t_cord);
                tt_pos[0] = t_scale.x(tt_pos[0]);
                tt_pos[1] = t_scale.y(tt_pos[1]);
                if(v_child.id != t_model.id)
                    t_vp.select(".vpLantern")
                .style("opacity",1)
                .style("display","block")
                .attr("transform", "translate("+tt_pos+")");
            }
        },

        dimLights: function(){
            this.highlight(false);
        },

        getViewpoint: function(v_child, v_pos){
            var t_dist = [], t_data = this.collection.data;
            v_child.model.projection
            .forEach(function(t_d, t_i){
                t_dist[t_i] = Math.pow(Math.sqrt(Math.pow((t_d[0]-v_pos[0]),2)+Math.pow((t_d[1]-v_pos[1]),2)),3);
            });
            var t_sum = 0, t_min = d3.min(t_dist), t_viewpoint = [], t_weights = [];
            if(t_min == 0){
                for(var t_i in t_dist){
                    if(t_dist[t_i]==0)
                        t_viewpoint = t_data[t_i];
                }
            }else{
                for(var t_i in t_dist){
                    t_sum += 1/t_dist[t_i];
                };
                for(var t_i in t_dist){
                    t_weights[t_i] = (1/t_dist[t_i])/t_sum;
                };
                t_weights = [t_weights];
                t_viewpoint = numeric.dot(t_weights, t_data);
            }
            return t_viewpoint[0];
        },

        updatePCA: function(v_child, v_state){
            var t_data = this.collection.data;
            this.collection.updateVPID = v_child.id;
            console.info("ViewpointCollectionView: "+((v_state=="Expand" || v_state=="Separate")?"":"Inverse ")+"PCA");
            Datacenter.updateCoordinates([]);
        },

        fixProjection: function(v_last){
            if(v_last){
                $(".vpHighlight").insertAfter(v_last);
            }else{
                $(".vpHighlight").insertBefore(".groupMember:first");
            }
        },

        highlightData: function(v_opt){
            var self = this, t_light = self.light.light, t_data = v_opt.data, t_duration = this.transition.quick, t_dark = self.light.dark;
            if(v_opt.state){
                if(t_data.length == 0){
                    self.d3el.selectAll(".vpProjectionPoint circle")
                    .transition()
                    .duration(t_duration)
                    .attr("fill", function(){
                        return t_dark;
                    });
                }else{
                    var t_objs = self.d3el.selectAll(".vpProjectionPoint")
                    .filter(function(){
                        var t_i = $(this).attr("index");
                        return t_data.indexOf(t_i)>=0;
                    })
                    .classed("vpHighlight", true);
                    t_objs
                    .select("circle")
                    .transition()
                    .duration(t_duration)
                    .attr("fill", function(){
                        return v_opt.color;
                    });
                    if(self.d3el.select(".groupMember").empty()){
                        var tt_objs = self.d3el.selectAll(".vpProjectionPoint")
                        .filter(function(){
                            var t_i = $(this).attr("index");
                            return t_data.indexOf(t_i)<0;
                        });
                        tt_objs = tt_objs[0];
                        var t_last = tt_objs[tt_objs.length-1];
                        self.fixProjection(t_last);
                    }else{
                        self.fixProjection(null);
                    }
                }
            }else{
                    self.d3el.selectAll(".vpProjectionPoint").classed("vpHighlight", false);
                    if(self.d3el.select(".groupMember").empty()){
                        self.d3el.selectAll(".vpProjectionPoint circle")
                        .transition()
                        .duration(t_duration)
                        .attr("fill", function(){
                            return $(this).attr("color");
                        });
                    }else{
                        self.d3el.selectAll(".groupMember circle")
                        .transition()
                        .duration(t_duration)
                        .attr("fill", function(){
                            return $(this).attr("color");
                        });
                        self.d3el.selectAll(".vpProjectionPoint")
                        .filter(function(){
                            return !d3.select(this).classed("groupMember");
                        })
                        .select("circle")
                        .transition()
                        .duration(t_duration)
                        .attr("fill", function(){
                            var t_col = $(this).attr("color");
                            var tt_col = d3.interpolateHsl(t_light, t_col);
                            return tt_col(0.2);
                        });
                    }
            }
        },

        changeDataColor: function(v_opt){
            var self = this, t_data = v_opt.data, t_col = v_opt.color;
            if(t_data.length == 0){
                self.d3el.selectAll(".vpProjectionPoint circle")
                .attr("color", self.light.dark);
            }else{
                self.d3el.selectAll(".groupMember circle")
                .attr("color", t_col);
                self.d3el.selectAll(".vpProjectionPoint")
                .filter(function(){
                    return !d3.select(this).classed("groupMember");
                })
                .select("circle")
                .attr("color", self.light.dark);
            }
            self.highlightData({data: null, state: false, color: null});
        },

        getClusterCord: function(v_child, v_clusters){
            var t_cords = Datacenter.getClusterCord(v_clusters, Config.get("optimization"));
            var t_model = v_child.model;
            t_model.getClusterCord(t_cords);
        },

        getModifyCord: function(v_child, v_clusters, v_type){
            var t_cords = Datacenter.getClusterCord(v_clusters, Config.get("optimization"));
            var t_model = v_child.model;
            t_model.getModifyCord(t_cords, v_type);
        },

        clearAll: function(){
        },
    },Base));

return ViewpointCollection;
});
