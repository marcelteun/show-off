var frag_shader = `
	precision mediump float;

	varying vec4 vColor;

	void main(void) {
		gl_FragColor = vColor;
	}
`;

var vert_shader = `
	attribute vec3 aVertexPosition;
	attribute vec4 aVertexColor;

	uniform mat4 uMVMatrix;
	uniform mat4 uPMatrix;

	varying vec4 vColor;

	void main(void) {
		gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
		vColor = aVertexColor;
	}
`;

function Shape(canvas) {
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

Shape.prototype.initGL = function(canvas) {
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

Shape.prototype.compile_shader = function(shader, prog) {
	var gl = this.gl;
	gl.shaderSource(shader, prog);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw prog + ":\n" + gl.getShaderInfoLog(shader);
	}
}

Shape.prototype.compile_f_shader = function(prog) {
	var shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
	this.compile_shader(shader, prog);
	return shader;
}

Shape.prototype.compile_v_shader = function(prog) {
	var shader = this.gl.createShader(this.gl.VERTEX_SHADER);
	this.compile_shader(shader, prog);
	return shader;
}

Shape.prototype.initShaders = function() {
	var gl = this.gl;

	var fragmentShader = this.compile_f_shader(frag_shader);
	var vertexShader = this.compile_v_shader(vert_shader);

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

Shape.prototype.setMatrixUniforms = function() {
	var gl = this.gl;

	gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, this.pMatrix);
	gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, this.mvMatrix);
}

Shape.prototype.initBuffers = function() {
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

Shape.prototype.drawScene = function() {
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
	var ogl = new Shape(canvas);
}
