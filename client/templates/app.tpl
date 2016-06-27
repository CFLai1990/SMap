<div id = "leftTop">
	<div id="ViewcollectionViewNav">
		<div>
			<span>Viewpoints</span></br>
			<div class="btn-group" data-toggle="buttons" id="OptimizationControl">
				<button type="button" class="btn btn-xs btn-default selected" id="OptimizationControlExpand" data-toggle="tooltip" data-placement="bottom" title="Expand"><i class="iconfont large">&#xe602;</i></button>
				<button type="button" class="btn btn-xs btn-default" id="OptimizationControlCompress" data-toggle="tooltip" data-placement="bottom" title="Compress"><i class="iconfont large">&#xe601;</i></button>
				<button type="button" class="btn btn-sm btn-default" id="OptimizationControlSeparate" data-toggle="tooltip" data-placement="bottom" title="Separate"><span style="font-size: 20px" class="glyphicon glyphicon-resize-full"></span></button>
			</div>
		</div>
		<div style="margin-left: 10px">
			<span>Focus</span></br>
			<div class="btn-group" data-toggle="buttons" id="FocusControl">&nbsp;
				<button type="button" class="btn btn-sm btn-default" id="FocusControlPoint" data-toggle="tooltip" data-placement="bottom" title="Point"><i class="iconfont">&#xe604;</i></button>
				<button type="button" class="btn btn-sm btn-default selected" id="FocusControlGroup" data-toggle="tooltip" data-placement="bottom" title="Group"><i class="iconfont">&#xe603;</i></button>
			</div>
		</div>
		<div style="margin-left: 10px">
			<span>Suggestion</span></br>
			<div class="btn-group" data-toggle="buttons" id="SuggestionControl">&nbsp;
				<button type="button" class="btn btn-sm btn-default selected" id="SuggestionControlNone" data-toggle="tooltip" data-placement="bottom" title="None"><i class="iconfont">&#xe609;</i></button>
				<button type="button" class="btn btn-sm btn-default" id="SuggestionControlNew" data-toggle="tooltip" data-placement="bottom" title="Suggestion"><i class="iconfont">&#xe607;</i></button>
			</div>
		</div>
		<div style="margin-left: 10px">
			<span>Selection</span></br>
			<div class="btn-group" data-toggle="buttons" id="ModificationControl">&nbsp;
				<button type="button" class="btn btn-sm btn-default selected" id="ModificationNew" data-toggle="tooltip" data-placement="bottom" title="New Selection"><i class="iconfont">&#xe608;</i></button>
				<button type="button" class="btn btn-sm btn-default" id="ModificationOldAdd" data-toggle="tooltip" data-placement="bottom" title="Focus: Increase"><i class="iconfont">&#xe60a;</i></button>
				<button type="button" class="btn btn-sm btn-default" id="ModificationOldMinus" data-toggle="tooltip" data-placement="bottom" title="Focus: Reduce"><i class="iconfont">&#xe60c;</i></button>
			</div>
		</div>
		<div class="checkboxDiv" style="margin-left: 12px">
			<span id="AxesControl" class="MyControl">Axes</span>&nbsp;
			<input type="checkbox" id="AxesCheckbox" checked="true" class="MyCheckbox"><label for="AxesCheckbox"></label>
		</div>
		<div class="checkboxDiv" style="margin-left: 12px">
			<span id="SubspaceControl" class="MyControl">Subspace</span>&nbsp;
			<input type="checkbox" id="SubspaceCheckbox" class="MyCheckbox"><label for="SubspaceCheckbox"></label>
		</div>
		<div class="checkboxDiv" style="margin-left: 12px">
			<span id="ContextControl" class="MyControl">Context</span>&nbsp;
			<input type="checkbox" id="ContextCheckbox" checked="true" class="MyCheckbox"><label for="ContextCheckbox"></label>
		</div>
<!-- 	              <span style="margin-left: 12px" id="SuggestionControl" class="MyControl">Suggestion</span>&nbsp;
	<input type="checkbox" id="SuggestionCheckbox" checked="true" class="MyCheckbox"><label for="SuggestionCheckbox"></label> -->
	<i class="iconfont hiddenIcon" id = "Trash">&#xe600;</i>
	<i class="iconfont hiddenIcon" id = "InfoIcon">&#xe605;</i>
	<button type="button" class="btn btn-xs btn-default AddBtn" id="AddCluster" data-toggle="tooltip" data-placement="bottom" title="Add Cluster" style="font-size:18px;float: right;position: relative;top:18px"><span class="glyphicon glyphicon-plus"></span></button>
	<!-- <span style="float: right;position: relative;top:10px">Add Cluster&nbsp;</span> -->
</div>
</div>
<div id = 'leftBottom'>
</div>
<div id = 'rightTop'>
</div>
<div id = 'rightBottom'>
</div>
<span id="ruler"></span>
<!-- <div id = 'right-bottom'>
</div> -->