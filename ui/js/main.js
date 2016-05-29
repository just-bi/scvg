(function(exports) {
	
function eachSqlVar(sql, callback){
	var varRegExp = /('([^']|'')*')|("[^"]+")|(:("[^"]+"|\w+))/g, match;
	while (match = varRegExp.exec(sql)) {
		if (!match[4]) {
			continue;
		} 
		callback(match[4], varRegExp.lastIndex);
	}
}

function gEl(id) {
	return document.getElementById(id);
}
function cEl(tag){
	return document.createElement(tag);
}

var template;
function getTemplate(callback){
  if (template) {
	callback(template);
	return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "templates/calculationview.xml", true);
  xhr.onreadystatechange = function(){
    switch (xhr.readyState){
	  case 0:
	    break;
	  case 4:
	    switch (xhr.status) {
	      case 200:
	    	template = xhr.responseText;
	    	callback(template);
	        break;
	      default:
	    	throw "Error loading template";
        }
	  break;
    }
  };
  xhr.send(null);
}
	
var controls = {};
var controlValues = {};

function addChangeListener(control, handler) {
  control.onchange = handler;
}

function init(ctrls) {
  var i, n = ctrls.length, control;
  for (i = 0; i < n; i++) {
	control = ctrls[i];
	control = gEl(control);
	controls[control.id] = control;
	addChangeListener(control, controlTouched);
  }
}

function populateSchema(schemas){
  if (arguments.length === 0) {
	  var xhr = new XMLHttpRequest();
	  xhr.open("GET", "../services/scvg.xsodata/schemas?$format=json", true);
	  xhr.onreadystatechange = function(){
	    switch (xhr.readyState){
		  case 0:
		    break;
		  case 4:
		    switch (xhr.status) {
		      case 200:
		    	populateSchema(JSON.parse(xhr.responseText).d.results);
		        break;
		      default:
		    	throw "Error loading template";
	        }
		  break;
	    }
	  };
	  xhr.send(null);
	  return;
  }	
  var control = gEl("schema");
  var i, n = schemas.length, schema, option;

  option = cEl("OPTION");
  control.appendChild(option);
  
  for (i = 0; i < n; i++) {
	  schema = schemas[i];
	  option = cEl("OPTION");
	  option.value = option.label = option.textContent = schema.SCHEMA_NAME
	  if (schema.SCHEMA_NAME === schema.CURRENT_SCHEMA) {
		  option.selected = true;
	  }
	  control.appendChild(option);
  }
}

function forEachVar(callback){
	var tBody = variablesTable.tBodies[0], rows = tBody.rows;
	var i, n = rows.length, row, cells, cell, name, value, input; 
	for (i = 0; i < n; i++){
		row = rows[i];
		cells = row.cells;
		name = cells[0].innerText;
		value = cells[1].firstChild.value;
		callback(name, value, row);
	}
}

var variablesTable = gEl("variables");
function renderVariables(sql){
	//first, see what vars are in the statement
	var vars = {};
	eachSqlVar(sql, function(sqlVar, index){
		vars[sqlVar] = "";
	})

	//now, see if any of this variables were already given a value in the vars ui table
	forEachVar(function(name, value, row){
		if (typeof(vars[name] !== "undefined")) {
			vars[name] = value;
		}
	});
	
	//clear the vars ui table
	var tBody = variablesTable.tBodies[0];
	var rows = tBody.rows;
	while (rows.length) {
		tBody.deleteRow(0);
	}

	//rebuild the vars ui table.
	var row, cells, cell, name, value, input;
	for (name in vars) {
		row = tBody.insertRow(rows.length);
		cells = row.cells;

		cell = row.insertCell(cells.length);
		cell.textContent = name;

		value = vars[name];
		cell = row.insertCell(cells.length);
		
		input = cEl("INPUT");
		cell.appendChild(input);
		input.value = value;
		addChangeListener(input, controlTouched);
	}
}

function controlTouched(event){
  var id = this.id;
  var value = this.value;
  if (typeof controlValues[id] === "undefined" || controlValues[id] !== value) {
	if (id === "sql" || id === "schema" || this.parentNode.parentNode.parentNode.parentNode.id === "variables") {
		if (id === "sql") {
	      renderVariables(value);
		}
		getColumnMetadata();
	}
	else {
		controlValues[id] = value;
		generateCalculationView();
	}
  }
}

function setMessage(text){
	var msg = gEl("message");
	msg.textContent = text;
}

function substituteVariables(sqlStatement){
	var vars = {};
	forEachVar(function(name, value){
		vars[name] = value;
	});
	var tokens = [], prevIndex = 0;
	eachSqlVar(sqlStatement, function(sqlVar, index){
		tokens.push(sqlStatement.substring(prevIndex, index - sqlVar.length));
		tokens.push(vars[sqlVar]);
		prevIndex = index;
	});	
	tokens.push(sqlStatement.substring(prevIndex));
	return tokens.join("");
}

function escXml(string){
	string = string.replace(/&/g, "&amp;");
	string = string.replace(/</g, "&lt;");
	string = string.replace(/>/g, "&gt;");
	string = string.replace(/"/g, "&quot;");
	string = string.replace(/'/g, "&apos;");
	return string;
}

function friendlyName(name){
	name = name.split("_");
	var n = name.length, i;
	for (i = 0; i < n; i++) {
		name[i] = name[i].substr(0, 1).toUpperCase() + name[i].substr(1).toLowerCase(); 
	}
	return name.join(" ");
}

var calculationView;
function generateCalculationView(template){
	if (arguments.length === 0) {
		getTemplate(function(template){
			generateCalculationView(template);
		});
		return;
	}
	calculationView = template;
	  "sql",
	  "view-name",
	  "version-number",
	  "view-type",
	  "description"

	var viewType = controls["view-type"];
	viewType = viewType.options[viewType.selectedIndex].value;
    calculationView = calculationView.replace(/\$\{VIEW_TYPE\}/g, viewType);

	var viewName = controls["view-name"].value.toUpperCase();
	var version = controls["version-number"].value;
	if (String(version).length < 2) {
		version = "0" + version;
	}
	if (String(version).length < 3) {
		version = "0" + version;
	}
	viewName = "CA_" + viewName + "_" + version;
	
	if (!/[A-Z][_A-Z0-9]/.test(viewName)){
		throw "Invalid view name " + viewName;
    }
	viewName = escXml(viewName);
	calculationView = calculationView.replace(/\$\{ID\}/g, viewName);

	var description = controls["description"];
	description = escXml(description.value);
	calculationView = calculationView.replace(/\$\{DESCRIPTION\}/g, description);
	
	var sql = controls["sql"];
	sql = escXml(sql.value);
	calculationView = calculationView.replace(/\$\{SQL\}/g, sql);
	
	var variables = [], variable, variables1 = [], escName;
	forEachVar(function(name, value){
		name = name.substr(1);
		escName = escXml(name);
		variable = [
		"    <variable id=\"" + escName + "\" parameter=\"true\">",
		"      <descriptions defaultDescription=\"" + escXml(friendlyName(name)) + "\"/>",
		"      <variableProperties datatype=\"VARCHAR\" length=\"64\" mandatory=\"true\">",
		"       <valueDomain type=\"empty\"/>",
		"       <selection multiLine=\"false\" type=\"SingleValue\"/>",
		"     </variableProperties>",
		"   </variable>"
	    ]
		variables.push(variable.join("\n"));
		variables1.push("<localVariable>#" + escName + "</localVariable>");
	});
	calculationView = calculationView.replace(/\$\{VARIABLES\}/g, variables.join("\n"));
	calculationView = calculationView.replace(/\$\{LOCAL_VARIABLES\}/g, variables1.join("\n"));
	
	var n = columnMetadata.length, i, column, attributes = [], logicalAttributes = [], lenProperty, label;
	for (i = 0; i < n; i++) {
		column = columnMetadata[i];
		escName = escXml(column.label);
		label = friendlyName(escName);
		
		switch (column.typeName){
		  case "NVARCHAR":
		  case "VARCHAR":
		  case "CHAR":
		  case "BINARY":
		  case "VARBINARY":
			  lenProperty = " length=\"" + column.precision + "\"";
			  break;
		  case "DECIMAL":
		  case "SMALLDECIMAL":
			  lenProperty = " precision=\"" + column.precision + "\" scale=\"" + column.scale + "\"";
			  break;
		  default:
			  lenProperty = "";
		}		
		attributes.push("        <viewAttribute datatype=\"" + column.typeName + "\" id=\"" + escName + "\"" + lenProperty + "/>");
        
		logicalAttributes.push([
        "      <attribute id=\"" + escName + "\" order=\"" + (i+1) + "\">",
        "        <descriptions defaultDescription=\"" + escXml(label) + "\"/>",
        "        <keyMapping columnObjectName=\"Script_View\" columnName=\"" + escName + "\"/>",
        "      </attribute>"
        ].join("\n"));
	}
	calculationView = calculationView.replace(/\$\{ATTRIBUTES\}/g, attributes.join("\n"));
	calculationView = calculationView.replace(/\$\{LOGICAL_ATTRIBUTES\}/g, logicalAttributes.join("\n"));
	
	gEl("output").value = calculationView;
	uploadDownloadLink(viewName + ".calculationview", calculationView);
}

function uploadDownloadLink(filename, contents){
	var link = gEl("download");
	link.textContent = "Download " + filename;
	link.href = "data:application/octet-stream;charset=utf-16le;base64," + btoa(contents);
	link.download = filename;
}

var columnMetadata = null;
function getColumnMetadata(){
  var sql = controls["sql"].value;
  var xhr = new XMLHttpRequest();
  var url = "../services/sqlmetadata.xsjs";
  
  var schema = gEl("schema");
  schema = schema.options[schema.selectedIndex].value;
  url += "?schema=" + schema;
  
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "text/plain");
  xhr.setRequestHeader("Accept", "application/json");
  xhr.onreadystatechange = function(){	  
    switch (xhr.readyState){
	  case 4:
	    switch (xhr.status) {
	      case 200:
	    	message = "SQL Valid";
			controlValues["sql"] = sql;
			columnMetadata = JSON.parse(xhr.responseText);
			generateCalculationView();
	        break;
	      default:
	        columnMetadata = null;
		    message = [
		      "Error getting metadata: ",
		      xhr.status + " " + xhr.statusText, ". ",
		      xhr.responseText
		    ].join("");
		    ;
        }
	    break;
	  default:
		message = "Busy getting metadata.";
    }
    setMessage(message);
  };
  sql = substituteVariables(sql);
  xhr.send(sql);
}

init([
  "sql",
  "view-name",
  "version-number",
  "view-type",
  "description",
  "schema"
]);
populateSchema();

})(this);