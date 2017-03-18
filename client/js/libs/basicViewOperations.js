(function () {
    'use strict';
    let $ = require("jquery");

    class PDFilter{// one PDFilter only controls one type of attribute, but allows multiple cross filters
        constructor(v_filterSetting){
            this.container = v_filterSetting.container;
            this.overallSelector = v_filterSetting.overallSelector;
            let t_ovlFiltFunc = v_filterSetting.overallFilterFunc;
            this.overallFilterFunc = (t_ovlFiltFunc == null)?((v_d) => {
                return true;
            }):t_ovlFiltFunc;
            this.subSelector = v_filterSetting.subSelector;
            this.controlAttr = v_filterSetting.controlAttr;
            this.static = v_filterSetting.static;
            this.animation = v_filterSetting.animation;
            if(typeof(this.animation) == "object"){
                let t_duration = this.animation.duration;
                this.animation.duration = (t_duration == null)?t_duration:400;
            }
            this.filterers = new Array();
            this.filterID = 0;
            this.ready = false;
        };
        init(){
            this.ready = true;
            let t_this = this, t_animation = this.animation,
                t_ovlFilter = this.overallFilterFunc,
                t_selection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc);
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            if(typeof(t_animation) == "function"){
                t_animation(t_selection, true);
            }else{
                t_selection.attr(t_animation.attr, t_animation.match);
            }
            this.filterers.signs = new Array();
            this.filterers.pickers = new Array();
            this.filterers.add = function(v_id, v_attr, v_filterFunc, v_picker = false){
                let t_animation = t_this.animation, t_filterSign = "PDfiltered_" + t_this.controlAttr + "_" + t_this.filterID,
                    t_selection = t_this.container.selectAll(t_this.overallSelector)
                    .filter(t_this.overallFilterFunc)
                    .classed(t_filterSign, true);
                this.push({
                    id: v_id,
                    attr: v_attr,
                    sign: t_filterSign,
                    func: v_filterFunc,
                    picker: v_picker,
                });
                if(v_picker == true){
                    this.pickers.push(t_filterSign);
                }else{
                    this.signs.push(t_filterSign);
                }
                t_this.filterID++;
                return t_this.filterID - 1;
            };
            this.filterers.findID = function(v_id){
                return this.findIndex((v_filterer) => {return v_filterer.id == v_id});
            };
            this.filterers.fitOthers = function(v_obj, v_filterSign){
                let t_allSigns = this.signs, t_has = true;
                for(let i = 0; i < t_allSigns.length; i++){
                    if(t_allSigns[i] == v_filterSign){
                        continue;
                    }else{
                        let t_sign_i = t_allSigns[i];
                        if(!d3.select(v_obj).classed(t_sign_i)){
                            t_has = false;
                            break;
                        }
                    }
                }
                return t_has;
            };
            this.filterers.fitPickers = function(v_obj, v_sign){
                let t_allPickers = this.pickers, t_fit = false;
                for(let i = 0; i < t_allPickers.length; i++){
                    let t_sign_i = t_allPickers[i];
                    if(v_sign != null && v_sign == t_sign_i){
                        continue;
                    }
                    if(d3.select(v_obj).classed(t_sign_i)){
                        t_fit = true;
                        break;
                    }
                }
                return t_fit;
            };
            this.filterers.getPickers = function(v_selection, v_sign){
                let t_filterers = this,
                    t_pickSelection = t_this.container
                    .selectAll(t_this.overallSelector)
                    .filter(t_this.overallFilterFunc)
                    .filter(function(){
                        return t_filterers.fitPickers(this, v_sign);
                    }),
                    t_objs = t_pickSelection[0];
                for(let i = 0; i < t_objs.length; i++){
                    v_selection[0].push(t_objs[i]);
                }
            };
            this.filterers.restoreOthers = function(v_sign){
                let t_allSigns = this.signs, t_objs = t_this.container.selectAll(t_this.overallSelector)
                    .filter(t_this.overallFilterFunc).classed(v_sign, true);
                for(let i = 0; i < t_allSigns.length; i++){
                    let t_sign = t_allSigns[i]
                    if(t_sign == v_sign){
                        continue;
                    }
                    t_objs = t_objs.filter(function(){
                        return d3.select(this).classed(t_sign);
                    });
                };
                return t_objs;
            };
        };
        setStatic(v_selection, v_match, v_selLength){
            let t_static = this.static,
                t_allSelection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc),
                t_isNormal = (t_allSelection[0].length == v_selLength);
            if(t_static != null){
                let t_staticAttrs = t_static.attrs, t_matches = t_static.match, t_misses = t_static.miss, t_normals = t_static.normal;
                for(let i = 0; i < t_staticAttrs.length; i++){
                    let t_attr = t_staticAttrs[i], t_noSpecial = (t_normals == null?true:t_normals[i]);
                    if(t_attr == "class"){
                        let t_match = t_noSpecial?v_match:(t_isNormal?false:v_match);
                        if(t_matches[i] != null){
                            v_selection.classed(t_matches[i], t_match);
                        }
                        if(t_misses[i] != null){
                            v_selection.classed(t_misses[i], !t_match);
                        }
                    }else{
                        let t_normalValue = (v_match?t_matches[i]:t_misses[i]),
                            t_specialValue = (v_match?t_misses[i]:t_matches[i]),
                            t_value = t_noSpecial?t_normalValue:(t_isNormal?t_normalValue:t_specialValue);
                        v_selection.attr(t_attr, t_value);
                    }
                }
            }
        };
        setAnimation(v_selection, v_match){
            let t_animation = this.animation;
            if(typeof(t_animation) == "function"){
                t_animation(v_selection, v_match);
            }else{
                v_selection
                .interrupt()
                .transition()
                .duration(t_animation.duration)
                .attr(t_animation.attr, v_match?t_animation.match:t_animation.miss);
            }
        };
        filterChange(v_id, v_attr, v_values, v_filterFunc, v_picker = false){
            let t_filterID = this.filterers.findID(v_id);
            if(t_filterID == -1){
                t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, v_picker);
            }
            let t_filterers = this.filterers,
                t_filterer = t_filterers[t_filterID],
                t_sign = t_filterer.sign,
                t_oldSign = t_sign + "_old",
                t_animation = this.animation,
                t_conditions = new Set(v_values),
                t_filterFunc = t_filterer.func,
                t_fAttr = t_filterer.attr,
                t_oldSelection = this.container.selectAll(this.overallSelector + "." + t_sign)
                .filter(this.overallFilterFunc)
                .classed(t_oldSign, true)
                .classed(t_sign, false),
                t_newSelection = this.container.selectAll(this.overallSelector)
                .filter(this.overallFilterFunc)
                .filter(function(){
                    let t_attr = d3.select(this).attr(t_fAttr);
                    if(t_filterFunc == null){
                        return t_conditions.has(t_attr);
                    }else{
                        return t_filterFunc(t_attr);
                    }
                })
                .filter(function(){
                    return t_filterers.fitOthers(this, t_sign);
                })
                .classed(t_sign, true);
            t_filterers.getPickers(t_newSelection);
            let t_falseToTrue = t_newSelection.filter(function(){
                    return !d3.select(this).classed(t_oldSign);
                }),
                t_trueToFalse = t_oldSelection.filter(function(){
                    return !d3.select(this).classed(t_sign);
                });
            this.container.selectAll("." + t_oldSign)
            .classed(t_oldSign, false);
            this.setStatic(t_falseToTrue, true, t_falseToTrue[0].length);
            this.setStatic(t_trueToFalse, false, t_trueToFalse[0].length);
            this.setAnimation(t_falseToTrue, true);
            this.setAnimation(t_trueToFalse, false);
        };
        pick(v_id, v_attr, v_values, v_filterFunc){
            let t_filterID = this.filterers.findID(v_id), t_return;
            if(t_filterID == -1){
                t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc, true);
                // this.restore(v_id, false);
            }
            let t_filterers = this.filterers,
                t_filterer = t_filterers[t_filterID],
                t_sign = t_filterer.sign,
                t_conditions = new Set(v_values),
                t_filterFunc = t_filterer.func,
                t_fAttr = t_filterer.attr;
            if(v_filterFunc != null){
                t_filterer.func = t_filterFunc = v_filterFunc;
            }
            this.restore(v_id, false);
            let t_selection = this.container.selectAll(this.overallSelector)
                .filter(this.overallFilterFunc)
                .filter(function(){
                    let t_attr;
                    if(t_fAttr == "data"){
                        t_attr = d3.select(this).data();
                    }else{
                        t_attr = d3.select(this).attr(t_fAttr);
                    }
                    if(t_filterFunc == null){
                        return t_conditions.has(t_attr);
                    }else{
                        return t_filterFunc(t_attr);
                    }
                })
                .classed(t_sign, true);
            t_filterers.getPickers(t_selection, t_sign);
            t_return = t_selection;
            let t_eleNum = t_selection[0].length;
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            this.setStatic(t_selection, true, t_eleNum);
            this.setAnimation(t_selection, true);
            return t_return;
        };
        filter(v_id, v_attr, v_values, v_filterFunc){
            let t_filterID = this.filterers.findID(v_id), t_return;
            if(t_filterID == -1){
                t_filterID = this.filterers.add(v_id, v_attr, v_filterFunc);
                // this.restore(v_id, false);
            }
            let t_filterers = this.filterers,
                t_filterer = t_filterers[t_filterID],
                t_sign = t_filterer.sign,
                t_conditions = new Set(v_values),
                t_filterFunc = t_filterer.func,
                t_fAttr = t_filterer.attr;
            if(v_filterFunc != null){
                t_filterer.func = t_filterFunc = v_filterFunc;
            }
            this.restore(v_id, false);
            let t_selection = this.container.selectAll(this.overallSelector)
                .filter(this.overallFilterFunc)
                .filter(function(){
                    let t_attr;
                    if(t_fAttr == "data"){
                        t_attr = d3.select(this).data();
                    }else{
                        t_attr = d3.select(this).attr(t_fAttr);
                    }
                    if(t_filterFunc == null){
                        return t_conditions.has(t_attr);
                    }else{
                        return t_filterFunc(t_attr);
                    }
                })
                .filter(function(){
                    return t_filterers.fitOthers(this, t_sign);
                })
                .classed(t_sign, true);
            t_filterers.getPickers(t_selection);
            t_return = t_selection;
            let t_eleNum = t_selection[0].length;
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            this.setStatic(t_selection, true, t_eleNum);
            this.setAnimation(t_selection, true);
            return t_return;
        };
        restore(v_id, v_match = true){
            let t_filterer = this.filterers.find((v_ft) => {return (v_ft.id == v_id);});
                if(t_filterer == null){
                    return null;
                }
            let t_filterSign = t_filterer.sign,
                t_picker = t_filterer.picker,
                t_filterers = this.filterers, t_selection, t_return,
                t_noPickers = true;
            if(!t_picker){
                t_selection = t_filterers.restoreOthers(t_filterSign);
            }else{
                t_selection = this.container.selectAll(this.overallSelector).filter(this.overallFilterFunc).classed(t_filterSign, false);
            }
            if(!t_picker && this.filterers.pickers.length > 0){
                let t_newSelection = t_selection
                .filter(function(){
                    let t_fit = t_filterers.fitPickers(this);
                    return !t_fit;
                });
                if(t_newSelection[0].length != t_selection[0].length){
                    t_noPickers = false;
                    t_selection = t_newSelection;
                }
            }
            t_return = t_selection;
            let t_eleNum = t_selection[0].length;
            if(this.subSelector != null){
                t_selection = t_selection.selectAll(this.subSelector);
            }
            let t_match = (v_match?t_noPickers:false);
            this.setStatic(t_selection, t_match, t_eleNum);
            this.setAnimation(t_selection, t_match);
            return t_return;
        };
    };

	window['BasicView'] = {
        hideTimers: new Map(),

        showOnTop: function(v_target, v_container){
            $(v_container).append($(v_target));
        },

        hide: function(v_id, v_selection, v_duration = 400, v_hide = true){
            if(v_hide){
                v_selection
                .interrupt()
                .transition()
                .duration(v_duration)
                .attr("opacity", 0);
                this.hideTimers.set(v_id, setTimeout(() => {
                    v_selection.style("display", "none");
                }, v_duration + 100));
            }else{
                let t_timers = this.hideTimers,
                    t_timer = t_timers.get(v_id);
                if(t_timer != null){
                    clearTimeout(t_timer);
                    t_timers.delete(v_id);
                }
                v_selection
                .style("display", "block")
                .interrupt()
                .transition()
                .duration(v_duration)
                .attr("opacity", 1);
            }
        },

        placeEvenly: function([v_width, v_height], v_glyphToMarginRatio, v_num, v_horizon = true){
        	let [t_width, t_height] = v_horizon?([v_width, v_height]):([v_height, v_width]),
                t_boxSize = Math.max(t_width, t_height),
        		t_marginWidth = t_boxSize / (v_glyphToMarginRatio * v_num + (v_num + 1)),
        		t_glyphSize = t_marginWidth * v_glyphToMarginRatio,
        		t_marginHeight = (v_height - t_glyphSize) / 2,
        		t_placement = new Array();
        	for(let i = 0; i < v_num; i++){
                let t_width = t_marginWidth * (i + 1) + t_glyphSize * i,
                    t_height = t_marginHeight,
                    t_pos = v_horizon?[t_width, t_height]:[t_height, t_width];
        		t_placement.push(t_pos);
        	}
        	return {
        		glyphs: t_placement,
        		glyphSize: t_glyphSize,
        		margin: [t_marginWidth, t_marginHeight],
        	};
        },

        filter: function(v_filterSetting){
            return new PDFilter(v_filterSetting);
        },

        colToRgb: function(v_colArr){
            let t_col = [~~(255*v_colArr[0]), ~~(255*v_colArr[1]), ~~(255*v_colArr[2])];
            return "rgb(" + t_col + ")";
        },

        getTransform: function(v_transform){
            let t_trans = v_transform,
                t_return = {
                    scale: 1.0,
                    translate: [0,0],
                    scaleFirst: true,
                };
            if(t_trans != null && t_trans != ""){
                let t_indScale = t_trans.indexOf("scale"),
                    t_indTrans = t_trans.indexOf("translate"),
                    t_translate, t_scale,
                    t_scaleFirst, t_scaleLength, t_transLength;
                t_scaleFirst = t_return.scaleFirst = (t_indScale >=0 && t_indScale > t_indTrans);
                if(t_indScale < 0){
                    t_scaleLength = 0;
                    if(t_indTrans < 0){
                        t_transLength = 0;
                    }else{
                        t_transLength = t_trans.length;
                    }
                }else{
                    if(t_indTrans < 0){
                        t_transLength = 0;
                        t_scaleLength = t_trans.length;
                    }else{
                        if(t_scaleFirst){
                            t_transLength = t_indScale;
                            t_scaleLength = t_trans.length - t_transLength;
                        }else{
                            t_scaleLength = t_transLength;
                            t_transLength = t_trans.length - t_scaleLength;
                        }
                    }
                }
                if(t_scaleLength > 0){
                    t_scale = t_trans.slice(t_indScale, t_indScale + t_scaleLength).replace("scale","").replace("(","").replace(")","");
                    t_return.scale = parseFloat(t_scale);
                }
                if(t_transLength > 0){
                    t_translate = t_trans.slice(t_indTrans, t_indScale + t_transLength).replace("translate","").replace("(","").replace(")","").split(",");
                    t_return.translate[0] = parseFloat(t_translate[0]);
                    t_return.translate[1] = parseFloat(t_translate[1]);
                }
            }
            return t_return;
        },

        transition: function(v_selection, v_attrMap, v_duration = 400){
            let t_animation = v_selection
                .interrupt()
                .transition()
                .duration(v_duration),
                t_it = v_attrMap.entries();
            while(!t_it.done){
                let t_attr = t_it.value[0],
                    t_value = t_it.value[1];
                if(typeof(t_value) == "function"){
                    t_animation = t_animation.attr(t_attr, function(v_d, v_i){
                        t_value(this, v_d, v_i);
                    });
                }else{
                    t_animation = t_animation.attr(t_attr, t_value);   
                }
            }
        },
	};
})();