/**
 * Created by Chufan Lai at 2015/12/20
 * view for the whole view map
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
    'ViewmapView',
], function(require, Mn, _, $, Backbone, Datacenter, Config, Base, ViewmapView) {
    'use strict';
         String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        }

    var ViewmapCollectionView = Mn.CollectionView.extend(_.extend({

        tagName: 'g',

        attributes: {
            "id":"Viewmap",
        },

        childView: ViewmapView,

        childEvents: {
        },

        childViewOptions: {
            layout: null,
        },

        initialize: function (options) {
            var self = this;
            var t_defaults = {
                layotu: null,
                point: {
                    r: 5,
                    R: 8,
                },
                G_width: 30,
                padding: 0.05,
                duration: 800,
                ready: false,
                size: null,
                err_range: [0,0.6],
                scales: {
                    x: d3.scale.linear().domain([0,1]),
                    y: d3.scale.linear().domain([0,1]),
                },
                light: Config.get("lightColor").light,
                dark: Config.get("lightColor").dark,
                fontSize: Config.get("fontSize"),
                fontSizeLarge: Config.get("fontSizeLarge"),
                g: null,
                sizeScale: 0.03,
                delete: false,
            };
            options = options || {};
            _.extend(this, t_defaults);
            _.extend(this, options);
            this.layout = Config.get("viewmapLayout");
            this.bindAll();
        },

        onShow: function(){
            var self = this;
            var t_width = self.layout.width * (1 - 2 * self.layout.marginRatio), t_height = self.layout.height * (1 - 2 * self.layout.topRatio);
            var t_size = this.size = Math.min(t_width, t_height), t_padding = t_size * self.padding;
            var t_top = (self.layout.height - t_size)/2, t_left = (self.layout.width - t_size)/2;
            self.scales.x.range([t_left + t_padding, t_left + t_size - t_padding]);
            self.scales.y.range([t_top + t_size - t_padding, t_top + t_padding]);
            self.g = self.d3el.append("g")
            .classed("viewmapBackground",true);
            self.g
            .append("rect")
            .attr("x",t_left)
            .attr("y",t_top)
            .attr("width",t_size)
            .attr("height",t_size)
            .attr("fill",Config.get("color").median);
            // self.d3el.on("mousemove", function(){
            //     self.d3el.select(".vmLantern")
            //     .style("display","none");
            //     var t_pos = d3.mouse(this);
            //     t_pos[0] = t_scale.x.invert(t_pos[0]);
            //     t_pos[1] = t_scale.y.invert(t_pos[1]);
            //     self.trigger("ViewpointView__highlight", t_pos);
            //     /*Change Projection Dynamically*/
            //     // if(self.state == "before")
            //     //     self.trigger("ViewpointView__updateProjection", {pos: t_pos, id: null});
            //     // d3.select(this)
            //     // .selectAll(".vpProjectionPoint circle")
            //     // .attr("fill", function(t_d){
            //     //     var t_distance = Math.sqrt(Math.pow((t_d[0]-t_pos[0]),2)+Math.pow((t_d[1]-t_pos[1]),2));
            //     //     return tc_scale(1-t_distance);
            //     // })
            // })
        },

        bindAll: function(){
            // this.listenTo(this.collection, "ViewpointCollection__ShowErrors", this.showErrors);
            // this.listenTo(this.collection, "ViewpointCollection__updateMap", this.updateMap);
            // this.listenTo(this.collection, "ViewpointCollection__ClearAll", this.clearAll);
            this.listenTo(this.collection, "ViewmapCollection__UpdateViewmap", this.updateVPMap);
            this.listenTo(this.collection, "ViewmapCollection__highlightViewpoint", this.highlightVP);
            this.listenTo(this.collection, "ViewmapCollection__ClearShown", this.clearShown);
            this.listenTo(this.collection, "ViewmapCollection__ClearAllVP", this.clearAll);
            this.listenTo(this.collection, "ViewmapCollection__UpdateProjection", this.updateProjection);
            this.listenTo(this.collection, "ViewmapCollection__changeFocusColor", this.changeFocusColor);
        },

        updateProjection: function(v_cords){
            Datacenter.getVPMapProjection(v_cords);
        },

        removeFocus: function(v_focusID){
            var self = this;
            d3.selectAll($(".vpMapPoint[fosID="+v_focusID+"]"))
            .interrupt()
            .transition()
            .duration(self.duration)
            .ease("linear")
            .style("opacity",0)
            .remove();
        },

        updateVPMap: function(v_addVP, v_rmVP, v_cord){
            var self = this, t_count = self.collection.count;
            if(v_addVP){
                self.addViewpoint(v_addVP, v_cord);
            }else{
                if(v_rmVP){
                    self.removeFocus(v_rmVP);
                }
            }
            self.updateViewpoints(v_rmVP);
        },

        addViewpoint: function(v_viewpoint, v_cord){
            var self = this, t_pos = v_viewpoint.position, t_opti = v_viewpoint.optimization, t_id = v_viewpoint.id,
            t_opti = v_viewpoint.optimization;
            t_pos = [self.scales.x(t_pos[0]), self.scales.y(t_pos[1])];
            var t_g = self.g.selectAll("#newViewpoint")
            .data([v_viewpoint])
            .enter()
            .append("g")
            .attr("transform", "translate("+t_pos+")")
            .attr("id", function(t_d){
                return "vpMapPoint_"+t_d.id;
            })
            .attr("fosID", function(t_d){
                return t_d.focusID;
            })
            .classed("vpMapPoint", true)
            // .classed(t_opti, true)
            .on("click", function(t_d){
                if(self.delete){
                    self.delete = false;
                    return;
                }
                Datacenter.showViewpoint({id: null, coordinate: t_d.coordinates, state: "Group", focus: t_d.focus, opti: t_d.optimization, color: t_d.color});
                self.collection.trigger("ViewmapCollection__HighlightFocus", t_d.focusID);
                self.d3el.selectAll(".shown").classed("shown",false);
                d3.select(this).classed("shown",true);
            })
            .on("mouseover", function(t_d, t_i){
                self.d3el.selectAll("g.hovered").classed("hovered", false);
                self.d3el.selectAll(".vpMapPoint").classed("pointHidden", true);
                d3.selectAll($(".vpMapPoint[fosID="+t_d.focusID+"]"))
                .classed("pointHidden", false)
                .classed("hovered", true);
                d3.select("#vpFocus_"+t_d.focusID).classed("hovered",true);
                Datacenter.highlightData(t_d.focus, true, t_d.color);
            })
            .on("mouseout", function(t_d){
                self.d3el.selectAll(".vpMapPoint").classed("pointHidden", false);
                self.d3el.selectAll("g.hovered").classed("hovered", false);
                d3.select("#vpFocus_"+t_d.focusID).classed("hovered",false);
                Datacenter.highlightData(t_d.focus, false, null);
            })
            .classed("shown", v_viewpoint.name == "All Data");
            self.renderGlyph(t_g, t_opti, v_cord);
            var t_length = v_viewpoint.name;
            t_length = t_length.visualLength(self.fontSize);
            var t_left = - t_length[0] / 2;
            // var t_trash = $(".hiddenIcon#Trash").get(0).innerHTML, tt_length = t_trash.visualLength(self.fontSizeLarge);
            // if(v_viewpoint.name != "All Data")
            //     t_g.append("text")
            //     .attr("x", t_left - tt_length[0])
            //     .attr("y", 2 * self.point.R+t_length[1]/2)
            //     .attr("fill",self.dark)
            //     .attr("stroke",self.dark)
            //     .attr("class", "trash iconfont")
            //     .text(t_trash)
            //     .on("click", function(t_d){
            //         self.delete = true;
            //         d3.select($(this).parent().get(0))
            //         .transition()
            //         .duration(self.duration)
            //         .ease("linear")
            //         .style("opacity",0)
            //         .remove();
            //         self.collection.deleteViewpoint(t_d);
            //     });
            // t_g.append("text")
            // .attr("x", t_left)
            // .attr("y", 2 * self.point.R+t_length[1]/2)
            // .attr("fill",self.dark)
            // .attr("stroke",self.dark)
            // .style("opacity", 0)
            // .attr("class", "title")
            // .text(function(t_d){
            //     return t_d.name;
            // });
            t_g.selectAll("circle")
            .transition()
            .ease("linear")
            .style("opacity",1)
            .duration(self.duration);
            t_g.selectAll(".title")
            .transition()
            .ease("linear")
            .style("opacity",1)
            .duration(self.duration);
        },

        renderGlyph: function(v_g, v_opti, v_cord){
            var self = this;
            if(v_opti == "Compress"){
                var vv_g = v_g.append("g")
                .attr("transform", "scale("+self.sizeScale+")");
                vv_g.append("path")
                .attr("d","M620.6208 608.9728l170.1888 20.0704c10.5728 1.408 20.0704-6.2976 21.3248-16.8192 1.2544-10.5472-6.2976-20.0704-16.8192-21.3248l-224.4864-26.4704c-5.8624-0.8192-11.6736 1.3312-15.8208 5.4784-4.1728 4.1472-6.1952 9.984-5.4784 15.8208L576 810.24c1.152 9.7536 9.4464 16.9472 19.0464 16.9472 0.7424 0 1.5104-0.0256 2.2784-0.128 10.5216-1.2288 18.0736-10.7776 16.8192-21.3248l-19.9168-168.8832 333.4656 333.4656c3.7376 3.7376 8.6528 5.632 13.568 5.632s9.8304-1.8688 13.568-5.632c7.5008-7.5008 7.5008-19.6608 0-27.1616L620.6208 608.9728z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                vv_g.append("path")
                .attr("d","M404.0448 202.2656c-10.5216 1.2288-18.0736 10.7776-16.8192 21.3248l20.1728 171.0848L75.8784 63.1296c-7.5008-7.5008-19.6608-7.5008-27.1616 0s-7.5008 19.6608 0 27.1616L378.5472 420.096l-168.0128-19.8144c-10.496-1.3568-20.0704 6.2976-21.3248 16.8192-1.2544 10.5472 6.2976 20.0704 16.8192 21.3248l224.4864 26.4704c0.7424 0.1024 1.5104 0.128 2.2528 0.128 5.0688 0 9.9584-1.9968 13.568-5.632 4.1728-4.1472 6.1952-9.984 5.4784-15.8208l-26.4704-224.4864C424.1152 208.5376 414.592 200.8576 404.0448 202.2656z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                vv_g.append("path")
                .attr("d","M963.712 63.1296c-7.5008-7.5008-19.6608-7.5008-27.1616 0L599.7824 399.8976l20.7872-176.3072c1.2544-10.5472-6.2976-20.0704-16.8192-21.3248-10.5984-1.3568-20.0704 6.2976-21.3248 16.8192l-26.4704 224.4864c-0.6912 5.8368 1.3312 11.6736 5.4784 15.8208 3.6352 3.6352 8.5248 5.632 13.568 5.632 0.7424 0 1.5104-0.0256 2.2528-0.128l224.512-26.4704c10.5216-1.2288 18.0736-10.7776 16.8192-21.3248-1.2288-10.5216-10.88-18.2016-21.3248-16.8192l-162.7904 19.1744L963.712 90.2656C971.2128 82.7648 971.2128 70.6304 963.712 63.1296z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                vv_g.append("path")
                .attr("d","M430.5152 564.4288l-224.4864 26.4704c-10.5216 1.2288-18.0736 10.7776-16.8192 21.3248 1.2288 10.5216 10.7776 18.176 21.3248 16.8192l172.672-20.352L48.7168 943.1552c-7.5008 7.5008-7.5008 19.6608 0 27.1616 3.7376 3.7376 8.6528 5.632 13.568 5.632s9.8304-1.8688 13.568-5.632l330.9824-330.9824-19.6352 166.4256c-1.2544 10.5472 6.2976 20.0704 16.8192 21.3248 0.768 0.1024 1.536 0.128 2.2784 0.128 9.6 0 17.8944-7.1936 19.0464-16.9472l26.4704-224.4864c0.6912-5.8368-1.3312-11.6736-5.4784-15.8208C442.1888 565.76 436.3264 563.6352 430.5152 564.4288z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                // v_g.append("circle")
                // .attr("cx",0)
                // .attr("cy",0)
                // .attr("r",self.point.r)
                // .attr("fill",function(t_d){
                //     return t_d.color
                // })
                // .style("opacity", 0)
                // .classed("inner", true);
            }
            if(v_opti == "Expand"){
                var vv_g = v_g.append("g")
                .attr("transform", "scale("+self.sizeScale+")");
                vv_g.append("path")
                .attr("d","M480 112 480 80 208 80 208 352 240 352 240 134.6 499.2 393.9 521.9 371.2 262.6 112Z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                vv_g.append("path")
                .attr("d","M1040 889.4 778.5 627.9 755.9 650.5 1017.4 912 800 912 800 944 1072 944 1072 672 1040 672Z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                vv_g.append("path")
                .attr("d","M800 80 800 112 1029 112 755 374.2 777.1 397.3 1040 145.8 1040 352 1072 352 1072 80Z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                vv_g.append("path")
                .attr("d","M494.3 624.9 240 888.1 240 672 208 672 208 944 480 944 480 912 261.4 912 517.3 647.1Z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 60);
                // v_g.append("circle")
                // .attr("cx",0)
                // .attr("cy",0)
                // .attr("r", self.point.R)
                // .attr("fill", function(t_d){
                //     return t_d.color
                // })
                // .attr("stroke", function(t_d){
                //     return t_d.color
                // })
                // .style("opacity", 0)
                // .classed("outer", true);
            }
            if(v_opti == "Separate"){
                var vv_g = v_g.append("g")
                .attr("transform", "scale("+self.sizeScale+")");
                vv_g.append("path")
                .attr("d","M500.494 603.55 334.402 769.642l72.04 72.039c6.003 6.004 9.505 14.008 9.505 22.513 0 17.51-14.508 32.018-32.018 32.018L159.807 896.212c-17.51 0-32.018-14.508-32.018-32.018L127.789 640.07c0-17.51 14.508-32.018 32.018-32.018 8.505 0 16.509 3.502 22.512 9.505l72.04 72.04L420.45 523.506c3.001-3.001 7.504-5.002 11.506-5.002s8.505 2.001 11.506 5.002l57.031 57.032c3.001 3.001 5.003 7.504 5.003 11.506S503.495 600.549 500.494 603.55zM896.211 383.93c0 17.51-14.508 32.018-32.018 32.018-8.505 0-16.509-3.502-22.513-9.505l-72.039-72.04L603.55 500.494c-3.001 3.001-7.504 5.002-11.506 5.002s-8.505-2.001-11.506-5.002l-57.032-57.032c-3.001-3.001-5.002-7.504-5.002-11.506s2.001-8.505 5.002-11.506l166.092-166.091-72.04-72.04c-6.003-6.003-9.505-14.007-9.505-22.512 0-17.51 14.508-32.018 32.018-32.018l224.123 0c17.51 0 32.018 14.508 32.018 32.018L896.212 383.93z")
                .attr("fill", function(t_d){
                    return t_d.color;
                })
                .attr("stroke", function(t_d){
                    return t_d.color
                })
                .attr("stroke-width", 30);
                // v_g.append("circle")
                // .attr("cx", - self.point.R / 2)
                // .attr("cy", - self.point.R / 2)
                // .attr("r", self.point.R * 0.8)
                // .attr("fill", function(t_d){
                //     return t_d.color
                // })
                // .attr("stroke", function(t_d){
                //     return t_d.color
                // })
                // .style("opacity", 0)
                // .classed("twoFold", true);
                // v_g.append("circle")
                // .attr("cx", self.point.R / 2)
                // .attr("cy", self.point.R / 2)
                // .attr("r", self.point.r * 0.8)
                // .attr("fill", function(t_d){
                //     return t_d.color
                // })
                // .attr("stroke", function(t_d){
                //     return t_d.color
                // })
                // .style("opacity", 0)
                // .classed("twoFold", true);
            }
            var tv_g = v_g.append("g")
            .attr("transform", "translate(3, -45)");
            self.dimensionGlyphs(tv_g, v_cord);
        },

        dimensionGlyphs: function(v_g, v_cord){
            var self = this, t = [];
            for(var i in v_cord){
                var tt = (v_cord[i][0] * v_cord[i][0] + v_cord[i][1] * v_cord[i][1])/2;
                t.push(tt);
            }
            var t_width = self.G_width / v_cord.length;
            var t_scale = d3.scale.linear().domain([0, 1]).range([0, 40]);
            for(var i = 0; i < v_cord.length; i++){
                var ttt = t_scale(t[i]);
                v_g.append("rect")
                .attr("x", i * t_width)
                .attr("y", 40-ttt)
                .attr("width", t_width)
                .attr("height", ttt)
                .attr("fill", function(d){
                    return d.color;
                });
            }
        },

        updateViewpoints: function(v_focusID){
            var self = this, t_models = self.collection, t_objs;
            if(v_focusID)
                t_objs = $(".vpMapPoint[fosID!="+v_focusID+"]");
            else
                t_objs = ".vpMapPoint";
            d3.selectAll(t_objs)
            .filter(function(t_d){
                return t_d.collection;
            })
            .transition()
            .ease("linear")
            .duration(self.duration)
            .attr("transform", function(d){
                var t_vp = t_models.get(d.id), t_pos = t_vp.position;
                t_pos = [self.scales.x(t_pos[0]), self.scales.y(t_pos[1])];
                return "translate("+t_pos+")";
            });
        },

        highlightVP: function(v_id){
            var self = this;
            self.d3el.selectAll(".shown").classed("shown",false);
            self.d3el.select("#vpMapPoint_"+v_id).classed("shown",true);
        },

        showErrors: function(v_info){
            var self = this, t_distance = _.map(v_info, "distance"), t_error = _.map(v_info, "error");
            var t_size = this.size * 0.9;
            var t_top = (self.layout.height - t_size)/2, t_left = (self.layout.width - t_size)/2;
            var t_dScale = d3.scale.linear().range([t_left, t_left+t_size]).domain(d3.extent(t_distance));
            var t_eScale = d3.scale.linear().range([t_top+t_size, t_top]).domain(self.err_range);//d3.extent(t_error)
            if(!this.ready){
                self.d3el
                .selectAll(".vpError")
                .data(v_info)
                .enter()
                .append("g")
                .classed("vpError", true)
                .attr("id", function(t_d, t_i){
                    return "vpError_"+t_i;
                })
                .append("circle")
                .attr("cx",function(t_d){
                    return t_dScale(t_d.distance);
                })
                .attr("cy",function(t_d){
                    return t_eScale(t_d.error);
                })
                .attr("r",self.point.r);
                // var t_zero = t_eScale(0);
                // self.d3el.append("line")
                // .classed("baseline",true)
                // .attr("x1",t_left)
                // .attr("y1",t_zero)
                // .attr("x2",t_left+t_size)
                // .attr("y2",t_zero)
                // .attr("stroke",Config.get("color").dark)
                // .attr("stroke-width",2);
                this.ready = true;
            }else{
                self.d3el
                .selectAll(".vpError circle")
                .data(v_info)
                .transition()
                .duration(self.duration)
                .attr("cx",function(t_d){
                    return t_dScale(t_d.distance);
                })
                .attr("cy",function(t_d){
                    return t_eScale(t_d.error);
                });
                // var t_zero = t_eScale(0);
                // self.d3el.select(".baseline")
                // .transition()
                // .duration(self.duration)
                // .attr("y1",t_zero)
                // .attr("y2",t_zero);
            }
        },

        updateMap: function(){
            var self = this, t_distance = this.collection.cordDist, t_cords = Config.get("data").coordinates;
            var t_proj = MDS.byDistance(t_distance);
            var t_size = this.size * 0.9;
            var t_top = (self.layout.height - t_size)/2, t_left = (self.layout.width - t_size)/2;
            var t_xScale = d3.scale.linear().range([t_left, t_left+t_size]).domain([0,1]);
            var t_yScale = d3.scale.linear().range([t_top+t_size, t_top]).domain([0,1]);//d3.extent(t_error)
            if(!this.ready){
                self.d3el
                .selectAll(".vpMapPoint")
                .data(t_proj)
                .enter()
                .append("g")
                .classed("vpMapPoint", true)
                .attr("id", function(t_d, t_i){
                    return "vpMapPoint_"+t_i;
                })
                .append("circle")
                .attr("cx",function(t_d){
                    return t_xScale(t_d[0]);
                })
                .attr("cy",function(t_d){
                    return t_yScale(t_d[1]);
                })
                .attr("r",self.point.r)
                .on("click",function(t_d, t_i){
                    Datacenter.showViewpoint({id: t_i, coordinate: numeric.transpose(t_cords[t_i]), state: 'point', focus: [], opti: null});
                    self.collection.trigger("ViewmapCollection__HighlightFocus", t_d.focusID);
                })
                .on("mousemove", function(t_d, t_i){
                    self.collection.getVCDistances(t_i);
                });
                // var t_zero = t_eScale(0);
                // self.d3el.append("line")
                // .classed("baseline",true)
                // .attr("x1",t_left)
                // .attr("y1",t_zero)
                // .attr("x2",t_left+t_size)
                // .attr("y2",t_zero)
                // .attr("stroke",Config.get("color").dark)
                // .attr("stroke-width",2);
                self.d3el.append("g")
                .attr("class","vmLantern")
                .style("display","none")
                .append("circle")
                .attr("cx",0)
                .attr("cy",0)
                .attr("r", self.point.r)
                .attr("fill",self.light);
                this.ready = true;
            }else{
                self.d3el
                .selectAll(".vpMapPoint circle")
                .data(t_proj)
                .transition()
                .duration(self.duration)
                .attr("cx",function(t_d){
                    return t_xScale(t_d[0]);
                })
                .attr("cy",function(t_d){
                    return t_yScale(t_d[1]);
                });
                // var t_zero = t_eScale(0);
                // self.d3el.select(".baseline")
                // .transition()
                // .duration(self.duration)
                // .attr("y1",t_zero)
                // .attr("y2",t_zero);
            }
        },

        changeFocusColor: function(t_option){
            var t_id = t_option.id, t_color = t_option.color, self = this;
            var t_data = d3.selectAll($(".vpMapPoint[fosID="+t_id+"]")).data();
            for(var i in t_data){
                t_data[i].color = t_color;
            }
            d3.selectAll($(".vpMapPoint[fosID="+t_id+"]"))
            .data(t_data)
            .enter();
            d3.selectAll($(".vpMapPoint[fosID="+t_id+"] circle"))
            .attr("fill", t_color)
            .attr("stroke", t_color);
            d3.selectAll($(".vpMapPoint[fosID="+t_id+"] path"))
            .attr("fill", t_color)
            .attr("stroke", t_color);
            d3.selectAll($(".vpMapPoint[fosID="+t_id+"] rect"))
            .attr("fill", t_color)
            .attr("stroke", t_color);
        },

        // clearAll: function(){
        //     var t_g = this.d3el.selectAll(".vpMapPoint");
        //     if(t_g)
        //         t_g.remove();
        //     this.ready = false;
        // },

        clearShown: function(){
            this.d3el.selectAll(".shown")
            .classed("shown",false);
        },

        clearAll: function(){
            this.d3el.selectAll(".vpMapPoint")
            .transition()
            .ease("linear")
            .duration(this.duration)
            .style("opacity", 0)
            .remove();
        },
    },Base));

    return ViewmapCollectionView;
});
