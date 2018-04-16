function OGL(canvas) {
	this.canvas = canvas;
	this.shaderProgram = null;
	this.mvMatrix = mat4.create();
	this.pMatrix = mat4.create();

	this.triangleVertexPositionBuffer = null;
	this.triangleVertexColorBuffer = null;
	this.squareVertexPositionBuffer = null;
	this.squareVertexColorBuffer = null;

	this.initGL(canvas);
	this.initShaders();
	this.initBuffers();

	var gl = this.gl;
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	this.drawScene();
}

OGL.prototype.initGL = function(canvas) {
	try {
		var gl = canvas.getContext("webgl");
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
		this.gl = gl;
	} catch (e) {
	}
	if (!gl) {
		alert("Could not initialise WebGL, sorry :-(");
	}
}

OGL.prototype.getShader = function(gl, id) {
	var shaderScript = document.getElementById(id);
	if (!shaderScript) {
		return null;
	}

	var str = "";
	var k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3) {
			str += k.textContent;
		}
		k = k.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, str);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

OGL.prototype.initShaders = function() {
	var gl = this.gl;

	var fragmentShader = this.getShader(gl, "shader-fs");
	var vertexShader = this.getShader(gl, "shader-vs");

	this.shaderProgram = gl.createProgram();
	gl.attachShader(this.shaderProgram, vertexShader);
	gl.attachShader(this.shaderProgram, fragmentShader);
	gl.linkProgram(this.shaderProgram);

	if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}

	gl.useProgram(this.shaderProgram);

	this.shaderProgram.vertexPositionAttribute = gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
	gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

	this.shaderProgram.vertexColorAttribute = gl.getAttribLocation(this.shaderProgram, "aVertexColor");
	gl.enableVertexAttribArray(this.shaderProgram.vertexColorAttribute);

	this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
	this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
}

OGL.prototype.setMatrixUniforms = function() {
	var gl = this.gl;

	gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, this.pMatrix);
	gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, this.mvMatrix);
}

OGL.prototype.initBuffers = function() {
	var gl = this.gl;

	this.triangleVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleVertexPositionBuffer);
	var vertices = [
		 0.0,  1.0,  0.0,
		-1.0, -1.0,  0.0,
		 1.0, -1.0,  0.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	this.triangleVertexPositionBuffer.itemSize = 3;
	this.triangleVertexPositionBuffer.numItems = 3;

	this.triangleVertexColorBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleVertexColorBuffer);
	var colors = [
		1.0, 0.0, 0.0, 1.0,
		0.0, 1.0, 0.0, 1.0,
		0.0, 0.0, 1.0, 1.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
	this.triangleVertexColorBuffer.itemSize = 4;
	this.triangleVertexColorBuffer.numItems = 3;


	this.squareVertexPositionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVertexPositionBuffer);
	vertices = [
		 1.0,  1.0,  0.0,
		-1.0,  1.0,  0.0,
		 1.0, -1.0,  0.0,
		-1.0, -1.0,  0.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	this.squareVertexPositionBuffer.itemSize = 3;
	this.squareVertexPositionBuffer.numItems = 4;

	this.squareVertexColorBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVertexColorBuffer);
	colors = [];
	for (var i=0; i < 4; i++) {
		colors = colors.concat([0.5, 0.5, 1.0, 1.0]);
	}
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
	this.squareVertexColorBuffer.itemSize = 4;
	this.squareVertexColorBuffer.numItems = 4;
}

OGL.prototype.drawScene = function() {
	var gl = this.gl;

	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Update: mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, this.pMatrix); mat4.perspective() API has changed.
	mat4.perspective (this.pMatrix, 45.0, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

	mat4.identity(this.mvMatrix);

	// Update: mat4.translate(this.mvMatrix, [-1.5, 0.0, -7.0]); mat4.translate() API has changed to mat4.translate(out, a, v)
	// where out is the receiving matrix, a is the matrix to translate, and v is the vector to translate by. z altered to
	// approximate original scene.
	mat4.translate(this.mvMatrix, this.mvMatrix, [-1.5, 0.0, -5.4]);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleVertexPositionBuffer);
	gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, this.triangleVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleVertexColorBuffer);
	gl.vertexAttribPointer(this.shaderProgram.vertexColorAttribute, this.triangleVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

	this.setMatrixUniforms();
	gl.drawArrays(gl.TRIANGLES, 0, this.triangleVertexPositionBuffer.numItems);

	mat4.translate(this.mvMatrix, this.mvMatrix, [3.0, 0.0, 0.0]);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVertexPositionBuffer);
	gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, this.squareVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.squareVertexColorBuffer);
	gl.vertexAttribPointer(this.shaderProgram.vertexColorAttribute, this.squareVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

	this.setMatrixUniforms();
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.squareVertexPositionBuffer.numItems);
}

function webGLStart() {
	var canvas = document.getElementById("lesson02-canvas");
	var ogl = new OGL(canvas);
}
