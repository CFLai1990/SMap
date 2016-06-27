clearTimeout/**
 * Created by Chufan Lai at 2016/02/03
 * view for storing focuses
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
    'ViewfocusView',
    ], function(require, Mn, _, $, Backbone, Datacenter, Config, Base, ViewfocusView) {
        'use strict';
        String.prototype.visualLength = function(d)
        {
            var ruler = $("#ruler");
            ruler.css("font-size",d+'px').text(this);
            return [ruler[0].offsetWidth, ruler[0].offsetHeight];
        }

        var ViewfocusCollectionView = Mn.CollectionView.extend(_.extend({

            tagName: 'g',

            attributes: {
                "id":"Viewfocus",
            },

            childView: ViewfocusView,

            childEvents: {
            },

            childViewOptions: {
                layout: null,
            },

            initialize: function (options) {
                var self = this;
                var t_width = parseFloat($("#ViewfocusViewSVG").css("width"));
                var t_height = parseFloat($("#ViewfocusViewSVG").css("height"));
                var t_defaults = {
                    layotu: null,
                    point: {
                        r: 5,
                        R: 18,
                    },
                    padding: 0.05,
                    duration: 600,
                    ready: false,
                    size: null,
                    scales: {
                        x: d3.scale.linear().domain([0,1]),
                        y: d3.scale.linear().domain([0,1]),
                    },
                    scroll: {
                      left: 0,
                      right: -1,
                      list: 0,
                      max: 6,
                      toLeft: null,
                      toRight: null,
                  },
                  circle: {
                    //circle.top * 2 + circle.r * 2 + circle.title = child.height
                    top: t_height * 0.015,
                    left: t_width * 0.05,
                    width: t_width * 0.9,
                    height: t_height * 0.18,
                    step: t_width * 0.15,
                    circleLeft: t_width * 0.05,
                    r: t_width * 0.025,//self.point.R
                    title: t_height * 0.06,
                    scale: d3.scale.linear().domain([0,1]).range([t_height*0.01,t_height*0.05]),
                },
                hover: {
                    shown: false,
                    timer: null,
                    time: 1200,
                },
                hoverOut: {
                    timer: null,
                    timer: 1200,
                },
                textHover: {
                    shown: false,
                    timer: null,
                    time: 1200,
                },
                textOut: {
                    timer: null,
                    time: 1200,
                },
                list: {
                    center: t_height * 0.5,
                    size: Math.max(Math.min(t_height * 0.15, 30), 20),
                },
                nodes: null,
                light: Config.get("lightColor").light,
                dark: Config.get("lightColor").dark,
                fontSize: Config.get("fontSize"),
                fontSizeLarge: Config.get("fontSizeLarge"),
                g: null,
                classColors: null,
                delete: false,
            };
            options = options || {};
            _.extend(this, t_defaults);
            _.extend(this, options);
            this.layout = Config.get("viewfocusLayout");
            this.bindAll();
            this.setClassColors();
        },

        onShow: function(){
            var self = this;
            var t_width = self.layout.width * (1 - 2 * self.layout.marginRatio), t_height = self.layout.height * (1 - 2 * self.layout.topRatio);
            var t_size = this.size = Math.min(t_width, t_height), t_padding = t_size * self.padding;
            var t_top = (self.layout.height - t_height)/2, t_left = (self.layout.width - t_width)/2;
            self.scales.x.range([t_left + t_padding, t_left + t_width - t_padding]);
            self.scales.y.range([t_top + t_height - t_padding, t_top + t_padding]);
            self.g = self.d3el.append("g")
            .classed("viewfocusContainer",true);
            self.g
            .append("g")
            .attr("class", "viewfocusBackground")
            .append("rect")
            .attr("x",t_left)
            .attr("y",t_top)
            .attr("width",t_width)
            .attr("height",t_height)
            .attr("fill",Config.get("color").median);
            self.renderPanel(self.g);
            self.initPickers();
        },

        bindAll: function(){
            this.listenTo(this.collection, "ViewmapCollection__AddFocus", this.addFocus);
            this.listenTo(this.collection, "ViewmapCollection__ClearAllFocus", this.clearAll);
            this.listenTo(this.collection, "ViewmapCollection__HighlightFocus", this.highlight);
            this.listenTo(this.collection, "ViewmapCollection__ReleaseFocus", this.releaseAll);
            this.listenTo(this.collection, "ViewmapCollection__changeFocusColor", this.changeFocusColor);
            this.listenTo(this.collection, "ViewmapCollection__changeFocusTitle", this.changeFocusTitle);
            this.listenTo(Config, "change:cluster", this.setClassColors);
        },

        addFocus: function(v_focus){
            var self = this, td_size = Config.get("data"), ttd_size;
            td_size = td_size.array?td_size.array.length:null;
            var tt_scale = d3.scale.linear().domain([1, td_size]).range([this.circle.r * 0.4, this.circle.r]);
            self.d3el.selectAll(".shown").classed("shown",false);
            var t_color;
            if(v_focus.color){
                t_color = v_focus.color;
            }else{
                var t_id = v_focus.ID%10;
                t_color = v_focus.color = (v_focus.name == "All Data"?self.dark:(self.classColors(t_id == 0?10:t_id)));
                ttd_size = (td_size?v_focus.group.length:null);
            }
            Datacenter.changeDataColor(v_focus.group, t_color);
            var t_g = self.nodes.selectAll(".nothing")
            .data([v_focus])
            .enter()
            .append("g")
            .attr("class", "vpFocus visible")
            .attr("transform", "translate(" + (self.circle.circleLeft + self.scroll.list * self.circle.step) + "," + (self.list.center  - 10) + ")")
            .attr("index", self.scroll.list)
            .on("click", function(t_d){
                if(!d3.select(this).classed("visible"))
                    return;
                if(self.delete){
                    self.delete = false;
                    return;
                }
                Datacenter.showFocus(t_d.group, t_d.color);
                self.highlight(t_d.ID);
                self.stopColorPicker();
            })
            .classed("shown", true)
            .attr("id", function(t_d){
                return "vpFocus_"+t_d.ID;
            })
            .on("mouseover", function(t_d){
                if(!d3.select(this).classed("visible"))
                    return;
                Datacenter.highlightData(t_d.group, true, t_d.color);
                d3.selectAll(".vpMapPoint").classed("pointHidden", true);
                d3.selectAll($(".vpMapPoint[fosID="+t_d.ID+"]"))
                .classed("pointHidden", false)
                .classed("hovered", true);
            })
            .on("mouseout", function(t_d){
                if(!d3.select(this).classed("visible"))
                    return;
                Datacenter.highlightData(t_d.group, false, null);
                d3.selectAll(".vpMapPoint").classed("pointHidden", false);
                d3.selectAll(".vpMapPoint").classed("hovered", false);
            });
            t_g
            .append("circle")
            .attr("cx",0)
            .attr("cy",0)
            .attr("r", td_size?tt_scale(ttd_size):self.circle.r)
            .attr("fill", t_color)
            .on("mouseover", function(t_d){
                if(!d3.select($(this).parent('g')[0]).classed("visible"))
                    return;
                if(t_d.ID>0){
                    var tt_pos = d3.mouse($("body")[0]), t_pos = d3.mouse(this);
                    if(!self.hover.shown){
                        self.hover.timer = setTimeout(function(){
                            self.showColorPicker(t_d.ID, true, [tt_pos[0] - t_pos[0] + self.circle.r, tt_pos[1] - t_pos[1] + self.circle.r], t_d.color);
                        }, self.hover.time);
                    }else{
                        if(t_d.ID == Config.get("changeColorID")){
                            self.toggleColor(false);
                        }
                    }
                }
            })
            .on("mouseout", function(t_d){
                if(!d3.select($(this).parent('g')[0]).classed("visible"))
                    return;
                if(!self.hover.shown){
                    self.stopColorPicker();
                }
                if(self.hover.shown && t_d.ID == Config.get("changeColorID")){
                    self.toggleColor(true);
                }
            });
            var t_text = v_focus.name, t_size = t_text.visualLength(12);
            if(td_size)
            t_g.append("text")
            .attr("x", - t_size[0]/2+5)
            .attr("y", self.circle.r*2.8)
            .text("(#"+ttd_size+")")
            t_g.append("text")
            .attr("class","title")
            .attr("x", - t_size[0]/2)
            .attr("y", self.circle.r*2)
            .text(t_text)
            .on("mouseover", function(t_d){
                if(!d3.select($(this).parent('g')[0]).classed("visible"))
                    return;
                if(t_d.ID>0){
                    var tt_pos = d3.mouse($("body")[0]), t_pos = d3.mouse(this);
                    if(!self.textHover.shown){
                        self.textHover.timer = setTimeout(function(){
                            self.showTitlePicker(t_d.ID, true, [tt_pos[0] - t_pos[0] - t_size[0], tt_pos[1] - t_pos[1] + self.circle.r * 2 + 10], t_d.name);
                        }, self.textHover.time);
                    }else{
                        if(t_d.ID == Config.get("changeTitleID")){
                            self.toggleTitle(false);
                        }
                    }
                }
            })
            .on("mouseout", function(t_d){
                if(!d3.select($(this).parent('g')[0]).classed("visible"))
                    return;
                if(!self.textHover.shown){
                    self.stopTitlePicker();
                }
                if(self.textHover.shown && t_d.ID == Config.get("changeTitleID")){
                    self.toggleTitle(true);
                }
            });
            var t_trash = $(".hiddenIcon#Trash").get(0).innerHTML, tt_length = t_trash.visualLength(self.fontSizeLarge);
            if(t_text != "All Data"){
                var t_left = - t_size[0] * 0.5 - 3;
                t_g.append("text")
                .attr("x", t_left - tt_length[0])
                .attr("y", self.circle.r*2)
                .attr("fill",self.dark)
                .attr("stroke",self.dark)
                .attr("class", "trash iconfont")
                .text(t_trash)
                .on("click", function(t_d){
                    self.delete = true;
                    self.stopColorPicker();
                    self.stopTitlePicker();
                    var t = d3.select($(this).parent().get(0));
                    t.classed("deleted", true);
                    self.deleteFocus(v_focus.ID, parseInt(t.attr("index")));
                    t.selectAll("*")
                    .transition()
                    .duration(self.duration)
                    .ease("linear")
                    .style("opacity",0)
                    .remove();
                    // self.collection.deleteViewpoint(t_d);
                });
            }
            self.updateList(1, true);
            setTimeout(function(){
                self.clearThings();
            }, 1000);
        },

        deleteFocus: function(v_id, v_index){
            var self = this, t_list = self.scroll;
            self.collection.deleteFocus(v_id);
            self.updateList(1, false);
            self.d3el.selectAll(".vpFocus")
            .filter(function(){
                if(d3.select(this).classed("deleted"))
                    return false;
                var t_id = parseInt($(this).attr("index"));
                if(t_id > v_index){
                    $(this).attr("index", t_id - 1);
                    return true;
                }else{
                    return false;
                }
            })
            .classed("visible",function(t_d){
                var t_id = parseInt($(this).attr("index"));
                if(t_id < t_list.left || t_id > t_list.right)
                    return false;
                else
                    return true;
            })
            .transition()
            .duration(this.duration)
            .ease("linear")
            .attr("transform",function(t_d){
                var t_id = parseInt($(this).attr("index"));
                return "translate(" + (self.circle.circleLeft +  t_id * self.circle.step) + "," + (self.list.center - 10) + ")";
            });
        },

        setClassColors: function(){
            var t_num = [];
            for(var i = 1; i <= 10; i++){
                t_num.push(i);
            }
            var t_color = d3.scale.category10().domain(t_num);//domain(d3.range(Config.get("clusterNumber"))
            this.classColors = t_color;
            Config.set("clusterColors", t_color);
        },

        highlight: function(v_id){
            var self = this;
            self.d3el.selectAll(".shown").classed("shown",false);
            self.d3el.select("#vpFocus_"+v_id).classed("shown",true);
        },

        releaseAll: function(){
            this.d3el.selectAll(".shown")
            .classed("shown", false);
        },

        updateList: function(v_num, v_add){
            var t_scl = this.scroll;
            if(v_add){
                t_scl.list += v_num;
                if(t_scl.list <= t_scl.max){
                    t_scl.right += v_num;
                }else{
                    this.moveNode('right');
                }
            }else{
                t_scl.list -= v_num;
                if(t_scl.right >= t_scl.list){
                    if(t_scl.left >0){
                        this.moveNode('left');
                    }else{
                        t_scl.right -= v_num;
                        this.updateTriangles(t_scl);
                    }
                }else{
                    this.updateTriangles(t_scl);
                }
            }
        },

        renderPanel: function(v_g){
            var self = this;
            this.nodes = v_g.append("g")
            .attr("class","Focuses")
            .attr("transform","translate("+this.circle.left+","+this.circle.top+")");

            var t_left = this.scroll.toLeft = this.renderList(v_g, [this.circle.left/2, this.list.center], this.list.size, 'left');
            t_left.on("click",function(){
                if(d3.select(this).classed("disabled"))
                    return;
                self.moveNode('left');
            });

            var t_right = this.scroll.toRight = this.renderList(v_g, [this.circle.width+this.circle.left*1.5, this.list.center], this.list.size, 'right');
            t_right.on("click",function(){
                if(d3.select(this).classed("disabled"))
                    return;
                self.moveNode('right');
            });

            // var t_text = this.id+'', t_size = t_text.visualSize(this.fontsize);
            // var t_g = v_g.append("g")
            // .attr("transform","translate("+(-this.left / 2)+","+(this.height/2)+")")
            // .attr("class","sequenceIdentity")
            // .on("click", function(){
            //     var tt_pos = d3.mouse($("body")[0]), t_pos = d3.mouse(this);
            //     self.showColorPicker(this, true, [tt_pos[0] - t_pos[0], tt_pos[1] - t_pos[1]]);
            // });
            // t_g.append("rect")
            // .attr("x",-this.left * 0.3)
            // .attr("y",-this.height*0.5)
            // .attr("width",this.left * 0.6)
            // .attr("height", this.height)
            // .attr("fill","#999");
            // t_g.append("text")
            // .attr("x",-t_size[0]/2)
            // .attr("y",t_size[0]*0.6)
            // .text(this.id);

            // var t_close = this.renderClose(v_g);
            // v_g.transition().duration(self.transition.duration).style("opacity",1);
        },

        renderList: function(v_g, v_pos, v_size, v_direction){
            var t_g = v_g.append("g")
            .attr("class","sequenceList disabled")
            .attr("transform","translate("+v_pos+")")
            .attr("id","direction_"+v_direction);
            var t_t1 = v_size/2, t_t2 = v_size*Math.sqrt(3)/4, t_angle;
            switch(v_direction){
                case 'up': t_angle = 180; break;
                case 'down': t_angle = 0; break;
                case 'left': t_angle = 90; break;
                case 'right': t_angle = -90; break;
            }
            var t_tri = t_g.append("polygon")
            .attr("points", (-t_t1)+","+(-t_t2)+" 0,"+t_t2+" "+t_t1+","+(-t_t2))
            .attr("transform","rotate("+t_angle+")");
            return t_g;
        },

        moveNode: function(v_direction){
            var t_list = this.scroll;
            if(v_direction == 'left'){
                if(t_list.left <= 0)
                    return;
                t_list.right--;
                t_list.left--;
            }else{
                if(t_list.right >= t_list.list-1)
                    return;
                t_list.right++;
                t_list.left++;
            }
            this.transNodes(false);
        },

        transNodes: function(v_sign){
            var t_list = this.scroll;
            this.nodes
            .transition()
            .duration(this.duration)
            .ease("linear")
            .attr("transform","translate("+(this.circle.left-t_list.left*this.circle.step)+","+this.circle.top+")");
            this.nodes.selectAll(".vpFocus")
            .classed("visible",function(t_d){
                var t_id = parseInt($(this).attr("index"));
                if(t_id < t_list.left || t_id > t_list.right)
                    return false;
                else
                    return true;
            });
            this.updateTriangles(t_list);
        },

        updateTriangles: function(v_list){
            this.scroll.toLeft.classed("disabled",v_list.left<=0);
            this.scroll.toRight.classed("disabled",(v_list.list - v_list.left <= v_list.max));
        },

        clearThings: function(){
            var t_sel = d3.select("#Viewfocus .viewfocusContainer+g");
            while(!t_sel.empty()){
                t_sel.remove();
                t_sel = d3.select("#Viewfocus .viewfocusContainer+g");
            }
        },

        toggleTitle: function(v_sign){
            var self = this;
            if(v_sign){
                self.textOut.time = Datacenter.holdTitlePicker(false);
                if(!self.textOut.timer){
                    self.textOut.timer = setTimeout(function(){
                        Datacenter.removeTitlePicker();
                        clearTimeout(self.textOut.timer);
                        self.textOut.timer = null;
                    }, self.textOut.time);
                }
            }else{
                Datacenter.holdTitlePicker(true);
                if(self.textOut.timer){
                    clearTimeout(self.textOut.timer);
                    self.textOut.timer = null;
                }
            }
        },

        toggleColor: function(v_sign){
            var self = this;
            if(v_sign){
                self.hoverOut.time = Datacenter.holdColorPicker(false);
                if(!self.hoverOut.timer){
                    self.hoverOut.timer = setTimeout(function(){
                        Datacenter.removeColorPicker();
                        clearTimeout(self.hoverOut.timer);
                        self.hoverOut.timer = null;
                    }, self.hoverOut.time);
                }
            }else{
                Datacenter.holdColorPicker(true);
                if(self.hoverOut.timer){
                    clearTimeout(self.hoverOut.timer);
                    self.hoverOut.timer = null;
                }
            }
        },

        initPickers: function(){
            var self = this;
            d3.select("#titlePickerDiv")
            .on("mouseover", function(){
                if(self.textHover.shown)
                    self.toggleTitle(false);
            })
            .on("mouseout", function(){
                if(self.textHover.shown)
                    self.toggleTitle(true);
            });
            d3.selectAll("#titlePickerDiv *")
            .on("mouseover", function(){
                if(self.textHover.shown)
                    self.toggleTitle(false);
            })
            .on("mouseout", function(){
                if(self.textHover.shown)
                    self.toggleTitle(true);
            });
        },

        showColorPicker: function(v_id, v_state, v_pos, v_col){
            var self = this;
            if(!v_state){
                Config.set("changeColorID", null);
                Datacenter.hideColorPicker();
            }else{
                self.hover.shown = true;
                Config.set("changeColorID", v_id);
                this.trigger("getColor", this.id);
                if(v_pos[0] + 224 > innerWidth){
                    v_pos[0] = innerWidth - 234;
                }
                Datacenter.showColorPicker(v_pos, "sequenceView", v_col, function(v_sign){
                    if(self.hover.shown)
                        self.toggleColor(v_sign);
                });
            }
        },

        stopColorPicker: function(){
            var self = this;
            if(self.hover.timer){
                clearTimeout(self.hover.timer);
                self.hover.timer = null;
            }
        },

        showTitlePicker: function(v_id, v_state, v_pos, v_text){
            var self = this;
            if(!v_state){
                Config.set("changeTitleID", null);
                Datacenter.hideTitlePicker();
            }else{
                self.textHover.shown = true;
                Config.set("changeTitleID", v_id);
                // this.trigger("getColor", this.id);
                if(v_pos[0]+270 > innerWidth){
                    v_pos[0] = innerWidth - 280;
                }
                Datacenter.showTitlePicker(v_pos, "sequenceView", v_text);
            }
        },

        stopTitlePicker: function(){
            var self = this;
            if(self.textHover.timer){
                clearTimeout(self.textHover.timer);
                self.textHover.timer = null;
            }
        },

        changeFocusColor: function(t_option){
            var t_id = t_option.id, t_color = t_option.color, self = this, v_group;
            self.hover.shown = false;
            if(t_id && t_color){
                self.d3el.select("#vpFocus_"+t_id+" circle")
                .attr("fill", function(t_d){
                    v_group = t_d.group;
                    return t_color;
                });
                if(self.d3el.select("#vpFocus_"+t_id).classed("shown")){
                    Datacenter.changeDataColor(v_group, t_color);
                }
            }
        },

        changeFocusTitle: function(t_option){
            var t_id = t_option.id, t_text = t_option.title, self = this, v_group;
            self.textHover.shown = false;
            if(t_id && t_text){
                var t_size = t_text.visualLength(12);
                self.d3el.select("#vpFocus_"+t_id+" .title")
                .text(t_text)
                .transition()
                .duration(self.duration)
                .attr("x", - t_size[0]/2);
                var t_trash = $(".hiddenIcon#Trash").get(0).innerHTML, tt_length = t_trash.visualLength(self.fontSizeLarge);
                var t_left = - t_size[0] * 0.5 - 3;
                self.d3el.select("#vpFocus_"+t_id+" .trash")
                .transition()
                .duration(self.duration)
                .attr("x", t_left - tt_length[0]);
            }
        },

        initList: function(){
            this.scroll = {
              left: 0,
              right: -1,
              list: 0,
              max: 6,
              toLeft: null,
              toRight: null,
          };
      },

      clearAll: function(){
        this.d3el.select(".Focuses")
        .remove();
        this.d3el.selectAll(".sequenceList").remove();
        this.initList();
        this.renderPanel(this.g);
    },
},Base));

return ViewfocusCollectionView;
});
