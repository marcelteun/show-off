function draw_shape(canvas_id, cam_dist) {
	var ogl = new Shape(canvas_id, cam_dist);
}

var frag_shader = `
	precision mediump float;

	varying vec4 vColor;

	void main(void) {
		gl_FragColor = vColor;
	}
`;

var vert_shader = `
	attribute vec3 v_pos_attr;
	attribute vec4 v_col_attr;

	uniform mat4 pos_mat;
	uniform mat4 proj_mat;

	varying vec4 vColor;

	void main(void) {
		gl_Position = proj_mat * pos_mat * vec4(v_pos_attr, 1.0);
		vColor = v_col_attr;
	}
`;

function create_gl_context(id) {
	var canvas = document.getElementById(id);

	var ctx = canvas.getContext("webgl");
	ctx.viewport_width = canvas.width;
	ctx.viewport_height = canvas.height;
	return ctx;
}

function Shape(canvas_id, cam_dist) {
	this.gl = create_gl_context(canvas_id);
	this.gl_init(cam_dist);
	this.gl.shader_prog = this.get_shader_prog();
	this.init_buffers();
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

Shape.prototype.get_shader_prog = function() {
	var gl = this.gl;

	var f_shader = this.compile_f_shader(frag_shader);
	var v_shader = this.compile_v_shader(vert_shader);

	shader_prog = gl.createProgram();
	gl.attachShader(shader_prog, v_shader);
	gl.attachShader(shader_prog, f_shader);
	gl.linkProgram(shader_prog);

	if (!gl.getProgramParameter(shader_prog, gl.LINK_STATUS)) {
		throw "Error initialising shaders";
	}

	gl.useProgram(shader_prog);

	shader_prog.v_pos_attr = gl.getAttribLocation(shader_prog, "v_pos_attr");
	gl.enableVertexAttribArray(shader_prog.v_pos_attr);

	shader_prog.v_col_attr = gl.getAttribLocation(shader_prog, "v_col_attr");
	gl.enableVertexAttribArray(shader_prog.v_col_attr);

	shader_prog.proj_mat = gl.getUniformLocation(shader_prog, "proj_mat");
	shader_prog.pos_mat = gl.getUniformLocation(shader_prog, "pos_mat");

	return shader_prog;
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
