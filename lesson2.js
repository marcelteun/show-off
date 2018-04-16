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

function Shape(canvas, cam_dist) {
	this.canvas = canvas;

	this.squareVertexPositionBuffer = null;
	this.squareVertexColorBuffer = null;

	this.initGL(canvas);
	this.gl_init(cam_dist);
	this.initShaders();
	this.init_buffers();

	var gl = this.gl;
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);

	this.draw();
}

Shape.prototype.gl_init = function(cam_dist) {
	var gl = this.gl;
	gl.proj_mat = mat4.create();
	gl.pos_mat = mat4.create();
	gl.mat_stack = [];
	gl.cam_dist = cam_dist;

	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
}

Shape.prototype.initGL = function(canvas) {
	try {
		var gl = canvas.getContext("webgl");
		gl.viewport_width = canvas.width;
		gl.viewport_height = canvas.height;
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

	gl.shader_prog = gl.createProgram();
	gl.attachShader(gl.shader_prog, vertexShader);
	gl.attachShader(gl.shader_prog, fragmentShader);
	gl.linkProgram(gl.shader_prog);

	if (!gl.getProgramParameter(gl.shader_prog, gl.LINK_STATUS)) {
		alert("Could not initialise shaders");
	}

	gl.useProgram(gl.shader_prog);

	gl.shader_prog.v_pos_attr = gl.getAttribLocation(gl.shader_prog, "aVertexPosition");
	gl.enableVertexAttribArray(gl.shader_prog.v_pos_attr);

	gl.shader_prog.v_col_attr = gl.getAttribLocation(gl.shader_prog, "aVertexColor");
	gl.enableVertexAttribArray(gl.shader_prog.v_col_attr);

	gl.shader_prog.proj_mat = gl.getUniformLocation(gl.shader_prog, "uPMatrix");
	gl.shader_prog.pos_mat = gl.getUniformLocation(gl.shader_prog, "uMVMatrix");
}

Shape.prototype.init_buffers = function() {
	var gl = this.gl;

	gl.vs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.vs);
	var vertices = [
		 0.0,  1.0,  0.0,
		-1.0, -1.0,  0.0,
		 1.0, -1.0,  0.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vs.elem_len = 3;
	gl.vs.no_of_elem = 3;

	gl.v_cols = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.v_cols);
	var colors = [
		1.0, 0.0, 0.0, 1.0,
		0.0, 1.0, 0.0, 1.0,
		0.0, 0.0, 1.0, 1.0
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
	gl.v_cols.elem_len = 4;
	gl.v_cols.no_of_elem = 3;
}

Shape.prototype.draw = function() {
	var gl = this.gl;

	gl.viewport(0, 0, gl.viewport_width, gl.viewport_height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	mat4.perspective(gl.proj_mat,
		45.0, gl.viewport_width / gl.viewport_height, 0.1, gl.cam_dist);

	mat4.identity(gl.pos_mat);
	mat4.translate(gl.pos_mat, gl.pos_mat, [-1.5, 0.0, -5.4]);

	/*
→       mvPushMatrix();
→       // Update: mat4.rotate(mvMatrix, degToRad(rPyramid), [0, 1, 0]); mat4.rotate() API has changed to mat4.rotate(out, a, rad, axis)
        // where out is the receiving matrix and a is the matrix to rotate.
	mat4.rotate(mvMatrix, mvMatrix, degToRad(rPyramid), [0, 1, 0]);
	*/

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.vs);
	gl.vertexAttribPointer(gl.shader_prog.v_pos_attr,
		gl.vs.elem_len, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.v_cols);
	gl.vertexAttribPointer(gl.shader_prog.v_col_attr,
		gl.v_cols.elem_len, gl.FLOAT, false, 0, 0);

	gl.uniformMatrix4fv(gl.shader_prog.proj_mat, false, gl.proj_mat);
	gl.uniformMatrix4fv(gl.shader_prog.pos_mat, false, gl.pos_mat);

	gl.drawArrays(gl.TRIANGLES, 0, gl.vs.no_of_elem);

	//mvPopMatrix();
}

function webGLStart() {
	var canvas = document.getElementById("lesson02-canvas");
	var ogl = new Shape(canvas, 100);
}
