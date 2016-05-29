(function(exports){

/*********************************************
* 
* 	Imports
* 
********************************************/
var xsjslib = "xsjslib";
var xsjslibpath = "../" + xsjslib + "/";
var xsjslibext = "." + xsjslib;

var error		=	$.import(xsjslibpath + "error" + xsjslibext); 
var params		=	$.import(xsjslibpath + "params" + xsjslibext); 
var sql			=	$.import(xsjslibpath + "sql" + xsjslibext); 
  

/*******************************************
* 
* 	HTTP/webservice stuff
* 	
*******************************************/

var httpStatus; 

params.define({
	"SCHEMA": {
		"type": "VARCHAR"
	}
});

function handlePost(parameters){
	var query;
	
    var conn = sql.getConnection();

    query = "SET SCHEMA " + parameters.SCHEMA;
    conn.executeUpdate(query);
    
    query = [
        $.request.body.asString(),
 	    "\nLIMIT 0"
    ].join("\n");
    var rs = conn.executeQuery(query);
    var metadata = rs.metadata.columns;
    
    var i, n = metadata.length, column, columns = [], p, v;
    for (i = 0; i < n; i++) {
    	column = {};
    	for (p in metadata[i]){
    		v = metadata[i][p];
    		column[p] = v;
    	}
    	columns.push(column);
    }

    httpStatus = $.net.http.OK;
	$.response.contentType = "application/json";
	$.response.setBody(JSON.stringify(columns, null, " "));
}

/**
*	Finds and executes the actual function that is to handle this request
*
*	@function handleRequest
*	@private
*	@param methods {object} An object that maps HTTP methods (keys) to functions (values)
*	@return {scalar} the value returned by the handler
*/
function handleRequest(methods){
	var method = $.request.headers.get('~request_method').toUpperCase();
	var handler = methods[method];
	if (!handler) {
		httpStatus = $.net.http.METHOD_NOT_ALLOWED;
		error.raise(
			"handleRequest",
			arguments,
			"No handler found for method " + method
		);
	}				
	var parameters = params.validate(method);
	var handlerResult = handler(parameters);
	return handlerResult;
}
/*
*	This is the actual entrypoint. 
*/
function main(){
	try {
		sql.openConnection();
		handleRequest({
			"POST": handlePost
		});
	}
	catch (e) {
		if (!httpStatus) {			
			httpStatus = $.net.http.BAD_REQUEST;
			$.response.contentType = "text/plain";
			$.response.setBody(e.toString());
		}
	}
	finally {
		sql.closeConnection();
		$.response.status = httpStatus || $.net.http.BAD_REQUEST;
	}
}
main();
	
	
})(this);