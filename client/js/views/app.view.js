/**
 * Created by aji on 15/7/13.
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'datacenter',
    'config',
    'ViewmapLayoutView',
    'ViewpointLayoutView',
    'ViewpointNavLayoutView',
    'ViewfocusLayoutView',
    'text!templates/app.tpl'
], function(require, Mn, _, $, Backbone, Datacenter, Config, ViewmapLayoutView, ViewpointLayoutView, ViewpointNavLayoutView, ViewfocusLayoutView,
            Tpl) {
    'use strict';

    return Mn.LayoutView.extend({

        tagName: 'div',

        template: _.template(Tpl),

        attributes:{
            'style' : 'width: 100%; height: 100%;'
        },

        regions:{
            'vpCollectionNav': '#leftTop',
            'vpCollection': '#leftBottom',
            'vpMap': '#rightBottom',
            'vpFocus': '#rightTop',
        },

        initialize: function (options) {
            var self = this;
            options = options || {};
            _.extend(this, options);
            this.vpCollection = null;
            this.vpMap = null;
            this.lights = true;
            this.vectors = false;
            this.ready = false;
            this.dark = Config.get("color").dark;
            this.light = Config.get("color").light;
            this.median = Config.get("color").median;
            this.layout = Config.get("layout");
            this.focusType = Config.get("focusType");
            this.optimization = Config.get("optimization");
            this.bindAll();
        },

        showChildViews: function(){
            var self = this;
            self.vpCollection = new ViewpointLayoutView();
            self.showChildView("vpCollection", self.vpCollection);
            self.vpMap = new ViewmapLayoutView();
            self.showChildView("vpMap", self.vpMap);
            self.vpFocus = new ViewfocusLayoutView();
            self.showChildView("vpFocus", self.vpFocus);
            console.info("LayoutView: child views ready!");
            if(!self.ready){
                self.ready = true;
                self.bindInteractions();
            }
        },

        onShow: function(){
            var self = this;
            $(document).ready(function(){
                console.info('LayoutView: document ready!');
                self.getLayoutParameters();
                Datacenter.start();
            });
        },

        bindAll: function(){
            this.listenTo(Datacenter, "DataCenter__initialized", this.showChildViews);
            this.listenTo(Datacenter, "DataCenter__changeOpti", this.changeOptimization);
            this.listenTo(Datacenter, "DataCenter__changeSuggestion", this.changeSuggestion);
        },

        bindInteractions: function(){
            var self = this;
            // $("#LightControl").on("click",function(){
            //     if(self.lights){
            //         self.lights = false;
            //         d3.select(this).select("#text")
            //         .text("Lights On");
            //         $("#lightControlOn").css("display","none");
            //         $("#lightControlOff").css("display","inline");
            //         $("body").css("background-color",self.dark);
            //         $(".viewpointBackground").css("fill",self.dark);
            //         $(".viewmapBackground rect").css("fill",self.dark);
            //         Config.set("lighting","dark");
            //     }else{
            //         self.lights = true;
            //         d3.select(this).select("#text")
            //         .text("Lights Off");
            //         $("#lightControlOn").css("display","inline");
            //         $("#lightControlOff").css("display","none");
            //         $("body").css("background-color",self.light);
            //         $(".viewpointBackground").css("fill",self.median);
            //         $(".viewmapBackground rect").css("fill",self.median);
            //         Config.set("lighting","light");
            //     }
            // });
            // $("#FocusCheckbox").bootstrapSwitch();
            $("#AxesControl").on("click",function(){
                var t_axisChecked = Config.get("showAxis");
                $("#AxesCheckbox")[0].checked = !t_axisChecked;
                Config.set("showAxis", !t_axisChecked);
            });
            $("#AxesCheckbox").on("click", function(){
                var t_axisChecked = Config.get("showAxis");
                $("#AxesCheckbox")[0].checked = !t_axisChecked;
                Config.set("showAxis", !t_axisChecked);
            });
            $("#SubspaceControl").on("click",function(){
                var t_subspaceChecked = Config.get("useSubspace");
                $("#SubspaceCheckbox")[0].checked = !t_subspaceChecked;
                Config.set("useSubspace", !t_subspaceChecked);
                Config.set("changeSubspace", !Config.get("changeSubspace"));
            });
            $("#SubspaceCheckbox").on("click", function(){
                var t_subspaceChecked = Config.get("useSubspace");
                $("#SubspaceCheckbox")[0].checked = !t_subspaceChecked;
                Config.set("useSubspace", !t_subspaceChecked);
                Config.set("changeSubspace", !Config.get("changeSubspace"));
            });
            $("#ContextControl").on("click",function(){
                var t_contextChecked = Config.get("showContext");
                $("#ContextCheckbox")[0].checked = !t_contextChecked;
                Config.set("showContext", !t_contextChecked);
            });
            $("#ContextCheckbox").on("click", function(){
                var t_contextChecked = Config.get("showContext");
                $("#ContextCheckbox")[0].checked = !t_contextChecked;
                Config.set("showContext", !t_contextChecked);
            });
            $("#VectorControl").on("click",function(){
                if(self.vectors){
                    self.vectors = false;
                    d3.select(this).select("#text")
                    .text("Show Vectors");
                    d3.select("#vectorControlIcon")
                    .attr("class","glyphicon glyphicon-eye-open");
                    Config.set("showVector",false);
                }else{
                    self.vectors = true;
                    d3.select(this).select("#text")
                    .text("Hide Vectors");
                    d3.select("#vectorControlIcon")
                    .attr("class","glyphicon glyphicon-eye-close");
                    Config.set("showVector",true);
                }
            });
            //Focus Control
            $("#FocusControlGroup").on("click",function(){
                // $("#FocusCheckbox")[0].checked = true;
                self.focusType = "Group";
                Config.set("focusType","Group");
                d3.selectAll("#FocusControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#FocusControlPoint").on("click",function(){
                // $("#FocusCheckbox")[0].checked = false;
                self.focusType = "Point";
                Config.set("focusType","Point");
                d3.selectAll("#FocusControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            // $("#FocusCheckbox").on("click",function(){
            //     if(this.checked){
            //             self.focusType = "Group";
            //             Config.set("focusType","Group");
            //             d3.selectAll("#FocusControl .selected").classed("selected", false);
            //             d3.select("#FocusControlGroup").classed("selected", true);
            //     }else{
            //             self.focusType = "Point";
            //             Config.set("focusType","Point");
            //             d3.selectAll("#FocusControl .selected").classed("selected", false);
            //             d3.select("#FocusControlPoint").classed("selected", true);
            //     }
            // });
            //Optimization Control
            $("#ViewcollectionViewNav button").tooltip({
                container: "#ViewcollectionViewNav",
            });
            $("#OptimizationControlCompress").on("click",function(){
                // $("#OptiCheckbox")[0].checked = true;
                self.optimization = "Compress";
                Config.set("optimization","Compress");
                Config.set("changeOptimization", !Config.get("changeOptimization"));
                d3.selectAll("#OptimizationControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#OptimizationControlExpand").on("click",function(){
                // $("#OptiCheckbox")[0].checked = false;
                self.optimization = "Expand";
                Config.set("optimization","Expand");
                Config.set("changeOptimization", !Config.get("changeOptimization"));
                d3.selectAll("#OptimizationControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#OptimizationControlSeparate").on("click",function(){
                // $("#OptiCheckbox")[0].checked = true;
                if(d3.select(this).classed("disabled")){
                    return;
                }
                self.optimization = "Separate";
                Config.set("optimization","Separate");
                Config.set("changeOptimization", !Config.get("changeOptimization"));
                d3.selectAll("#OptimizationControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            //Suggestion Control
            $("#SuggestionControlNone").on("click",function(){
                Config.set("suggestion", null);
                Config.set("changeSuggestion", !Config.get("changeSuggestion"));
                d3.selectAll("#SuggestionControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#SuggestionControlNew").on("click",function(){
                Config.set("suggestion","New");
                Config.set("changeSuggestion", !Config.get("changeSuggestion"));
                d3.selectAll("#SuggestionControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#ModificationOldAdd").on("click",function(){
                if(d3.select(this).classed("disabled")){
                    return;
                }
                Config.set("suggestion","Old");
                Config.set("modification", "Add");
                Config.set("changeSuggestion", !Config.get("changeSuggestion"));
                d3.selectAll("#ModificationControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#ModificationOldMinus").on("click",function(){
                if(d3.select(this).classed("disabled")){
                    return;
                }
                Config.set("suggestion","Old");
                Config.set("modification", "Minus");
                Config.set("changeSuggestion", !Config.get("changeSuggestion"));
                d3.selectAll("#ModificationControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            $("#ModificationNew").on("click",function(){
                if(d3.select(this).classed("disabled")){
                    return;
                }
                Config.set("modification","None");
                Config.set("changeSuggestion", !Config.get("changeSuggestion"));
                d3.selectAll("#ModificationControl .selected").classed("selected", false);
                d3.select(this).classed("selected", true);
                $(this).tooltip("hide");
            });
            // $("#OptiCheckbox").on("click",function(){
            //     if(this.checked){
            //             self.optimization = "Compress";
            //             Config.set("optimization","Compress");
            //             Config.set("changeOptimization", !Config.get("changeOptimization"));
            //             d3.selectAll("#OptimizationControl .selected").classed("selected", false);
            //             d3.select("#OptimizationControlCompress").classed("selected", true);
            //     }else{
            //             self.optimization = "Expand";
            //             Config.set("optimization","Expand");
            //             Config.set("changeOptimization", !Config.get("changeOptimization"));
            //             d3.selectAll("#OptimizationControl .selected").classed("selected", false);
            //             d3.select("#OptimizationControlExpand").classed("selected", true);
            //     }
            // });
            // $("#OptimizationControl").on("click",function(){
            //     switch(self.optimization){
            //         case "inner":
            //             self.optimization = "inter";
            //             Config.set("optimization","inter");
            //             d3.select(this).select("#text")
            //             .text("Expand");
            //             $("#OptimizationControlCompress").css("display","none");
            //             $("#OptimizationControlExpand").css("display","inline");
            //         break;
            //         case "inter":
            //             self.optimization = "inter";
            //             Config.set("optimization","inter");
            //             d3.select(this).select("#text")
            //             .text("Compress");
            //             $("#OptimizationControlExpand").css("display","none");
            //             $("#OptimizationControlCompress").css("display","inline");
            //         break;
            //     }
            // });
            $(".dataLoader").on("click",function(){
                var t_id = d3.select(this).attr("id");
                Datacenter.loadData(Config.get("dataLibrary")[t_id]);
                Config.set("currentData", t_id);
            })
            $("#LanternControl").on("click",function(){
                var t_lightingon = Config.get("lightingOn");
                Config.set("lightingOn", !t_lightingon);
                if(!t_lightingon){
                    d3.select(this).select("#text")
                    .text("Hide Lantern");
                    $("#lanternControlOn").css("display","none");
                    $("#lanternControlOff").css("display","inline");
                    self.lights = false;
                    $("body").css("background-color",self.dark);
                    $(".viewpointBackground").css("fill",self.dark);
                    $(".viewmapBackground rect").css("fill",self.dark);
                    Config.set("lighting","dark");
                }else{
                    d3.select(this).select("#text")
                    .text("Show Lantern");
                    $("#lanternControlOn").css("display","inline");
                    $("#lanternControlOff").css("display","none");
                    self.lights = true;
                    $("body").css("background-color",self.light);
                    $(".viewpointBackground").css("fill",self.median);
                    $(".viewmapBackground rect").css("fill",self.median);
                    Config.set("lighting","light");
                }
            });
        },

        changeOptimization: function(v_option){
            var t_state = v_option.state, t_disable = v_option.disable, self = this;
            if(t_state){
                self.optimization = t_state;
                d3.selectAll("#OptimizationControl button").classed("selected", false);
                d3.select("#OptimizationControl"+t_state).classed("selected", true);
            }
            if(t_disable.length>0){
                for(var i in t_disable){
                    d3.select("#OptimizationControl"+t_disable[i]).classed("disabled", true);
                    d3.selectAll("#ModificationOldAdd").classed("disabled", true);
                    d3.selectAll("#ModificationOldMinus").classed("disabled", true);
                }
            }else{
                d3.selectAll("#OptimizationControl button").classed("disabled", false);
                d3.selectAll("#ModificationOldAdd").classed("disabled", false);
                    d3.selectAll("#ModificationOldMinus").classed("disabled", false);
            }
        },

        changeSuggestion: function(v_state){
                Config.set("suggestion", null);
                Config.set("changeSuggestion", !Config.get("changeSuggestion"));
                d3.selectAll("#SuggestionControl .selected").classed("selected", false);
                var t = $("#SuggestionControl"+v_state)[0];
                d3.select(t).classed("selected", true);
                $(t).tooltip("hide");
        },

        getLayoutParameters: function(){
            var self = this, t_ly = this.layout;
            var t_navTop = parseFloat($("#Navbar").css("height")) + parseFloat($("#Navbar").css("margin-bottom"));
            t_ly.globalHeight = innerHeight;
            t_ly.globalWidth = innerWidth;
            t_ly.globalTop = t_navTop;
            t_ly.globalMargin = t_ly.globalWidth * t_ly.marginRatio;
            //Left Top View
            var t_leftWidth = t_ly.globalWidth * t_ly.leftWidthRatio;
            var t_leftTopHeight = t_ly.leftTopHeight;
            t_ly.leftTop = {
                top: t_ly.globalTop,
                left: t_ly.globalMargin,
                width: t_leftWidth,
                height: t_leftTopHeight,
                };
            this.updateView("#leftTop",t_ly.leftTop);
            var t_leftMidHeight = (t_ly.globalHeight - t_ly.globalTop) * 0;
            //Left Bottom View
            var t_leftWidth = t_ly.globalWidth * t_ly.leftWidthRatio;
            var t_leftBtmHeight = (t_ly.globalHeight - t_ly.globalTop) * (1 - t_ly.leftMidHeightRatio) - t_leftMidHeight - t_leftTopHeight;
            t_ly.leftBtm = {
                top: t_ly.globalTop + t_leftTopHeight + t_leftMidHeight,
                left: t_ly.globalMargin,
                width: t_leftWidth,
                height: t_leftBtmHeight,
                };
            this.updateView("#leftBottom",t_ly.leftBtm);
            //Right Top View
            var t_rightWidth = t_ly.globalWidth * t_ly.rightWidthRatio;
            var t_rightTopHeight = (t_ly.globalHeight - t_ly.globalTop) * t_ly.rightTopHeightRatio;
            t_ly.rightTop = {
                top: t_ly.globalTop,
                left: t_leftWidth + t_ly.globalMargin * 2,
                width: t_rightWidth,
                height: t_rightTopHeight,
            };
            this.updateView("#rightTop",t_ly.rightTop);
            var t_rightMidHeight = (t_ly.globalHeight - t_ly.globalTop) * t_ly.rightMidHeightRatio;
            //Right Bottom View
            var t_rightWidth = t_ly.globalWidth * t_ly.rightWidthRatio;
            var t_rightBtmHeight = (t_ly.globalHeight - t_ly.globalTop) * t_ly.rightBtmHeightRatio;
            t_ly.rightBtm = {
                top: t_ly.globalTop + t_rightTopHeight + t_rightMidHeight,
                left: t_leftWidth + t_ly.globalMargin * 2,
                width: t_rightWidth,
                height: t_rightBtmHeight,
            };
            this.updateView("#rightBottom",t_ly.rightBtm);
            Config.set("layout",this.layout);
        },

        updateView: function(v_region, v_layout){
            $(v_region)
            .css("top",v_layout.top)
            .css("left",v_layout.left)
            .css("width",v_layout.width)
            .css("height",v_layout.height);
        },
    });
});
