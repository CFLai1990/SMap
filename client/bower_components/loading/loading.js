/* 
    ./client/Loading.js
*/
(function(){

	window["Loading"] = {};

	Loading.v_selector = 'body';
	Loading.v_progressBar = null;
	Loading.v_show = true;
	Loading.v_txt = 'Loading...';
	Loading.v_progressBar = false;
	Loading.v_progressVal = 0;
	Loading.v_container = null;

	let container = '<div class="loading" id="loading"><div class="back"></div><div class="logo"><i class="fa fa-spinner fa-spin fa-lg"></i><span class="text">' + Loading.v_txt + '</span><div class="progressBar" style="display:none"><div class="progressBefore"></div><span class="progressVal"></span></div></div></div>';
	Loading.v_container = container;

	Loading.selector = function(value)
	{
		if(!arguments.length) return Loading.v_selector;
		if($(".loading").length == 0){
			Loading.v_selector = value;
			$(Loading.v_selector).append(Loading.v_container);
			Loading.update();
		}
		return Loading;
	}

	Loading.show = function(value)
	{
		if(!arguments.length) return Loading.v_show;
		if(value === true || value === 'true')
		{
			Loading.v_show = true;
		}
		else if(value === false || value === 'false')
		{
			Loading.v_show = false;
		}
		return Loading;
	}

	Loading.text = function(value)
	{
		if(!arguments.length) return Loading.v_txt;
		Loading.v_txt = value;
		return Loading;
	}

	Loading.progressVal = function(value)
	{
		if(!arguments.length) return Loading.v_progressVal;
		if(!isNaN(parseFloat(value)))
		{
			Loading.v_progressVal = parseFloat(value);
		}
		return Loading;
	}

	Loading.progressBar = function(value)
	{
		if(!arguments.length) return Loading.v_progressBar;
		if(value === true || value === 'true') Loading.v_progressBar = true;
		else if(value === false || value === 'false') Loading.v_progressBar = false;

		return Loading;
	}

	Loading.update = function()
	{
		if(Loading.v_show === true)
		{
			$(Loading.v_selector + ' .loading').show();
		}
		else
		{
			$(Loading.v_selector + ' .loading').hide();
		}

		if(Loading.v_progressBar === true)
		{
			$(Loading.v_selector + ' .loading .progressBar').show();
		}
		else
		{
			$(Loading.v_selector + ' .loading .progressBar').hide();
		}
		let finalwidth = parseFloat(Loading.v_progressVal) * 100 + '%';
		$(Loading.v_selector + ' .loading .progressBefore').css("width", finalwidth);// .animate({'width': finalwidth})
		$(Loading.v_selector + ' .loading .progressVal').html(parseFloat(Loading.v_progressVal) * 100 + '%');
		$(Loading.v_selector + ' .loading .text').html(Loading.v_txt);
		return Loading;
	}
})();
