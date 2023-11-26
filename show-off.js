/*
 * @license
 * Copyright (C) 2018 Marcel Tunnissen
 *
 * License: GNU Public License version 2
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not,
 * check at http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * or write to the Free Software Foundation,
 */
const raf = require('raf');
import {mat3, mat4, quat, vec2, vec3, vec4} from 'gl-matrix';

export {
	draw_local_shape,
	draw_shape,
	OrbitShape,
	MorphShape
};

var DEG2RAD = Math.PI/360;
var ARC_SCALE = 0.8; /* limit to switch rotation type for mouse */

function draw_url_shape(off_url,
		canvas_id,
		cam_dist,
		opt) {
	/* Retrieve the specified off-file, interpret the file and draw it on
	 * the canvas with the name 'canvas_id'.
	 *
	 * off_url: the complete url including the protocol.
	 * See draw_shape for more info.
	 */
	var result = {};
	var _opt = {};
	if (opt !== undefined) {
		_opt = opt;
	}
	fetch(off_url).then(function(response) {
		if(response.ok) {
			response.text().then(function(data) {
				result.shape = new Shape(data,
					canvas_id,
					cam_dist,
					_opt);
			});
		}
	})
	.catch(function(error) {
		console.error("error fetching", off_file, error);
	});

	return result;
}

function draw_shape(off_file,
		canvas_id,
		cam_dist,
		opt) {
	/* Retrieve the specified off-file, interpret the file and draw it on
	 * the canvas with the name 'canvas_id'.
	 *
	 * off_file: relative path of the off file.
	 * canvas_id: the name of the canvas to draw on
	 * cam_dist: the distance of the camera
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 and
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself is optional too.
	 */
	var result = {};
	var prot = window.location.protocol;
	var off_url = prot + "//" + window.location.host;
	var path_ar = window.location.pathname.split('/');
	var path = "";
	var _opt = {};
	if (opt !== undefined) {
		_opt = opt;
	}
	/* put together without file
	 * Ignore empty path: ["", "file.off"]
	 */
	if (path_ar.length > 2) {
		for (var i = 1; i < path_ar.length - 1; i++) {
			path += "/";
			path += path_ar[i];
		}
		off_url += path;
	}
	off_url += "/";
	off_url += off_file;
	if (prot == "http:" || prot == "https:") {
		result = draw_url_shape(off_url, canvas_id, cam_dist, _opt);
	} else if (prot == "file:") {
		/*
		 * File protocol is supported for testing purposes
		 * The solution below isn't used for http, since it is
		 * deprecated.
		 */
		var req = new XMLHttpRequest();
		req.open("GET", off_file, false);
		req.onreadystatechange = function () {
			if(req.readyState === 4) {
				if(req.status === 200 || req.status == 0) {
					result.shape = new Shape(req.responseText,
							canvas_id,
							cam_dist,
							_opt);
				} else {
					console.log("HTML status", req.status);
				}
			}
		}
		req.send()
	} else {
		console.log("protocol '" + prot + "' not supported");
	}
	return result;
}

function draw_local_shape(off_file, canvas_id, cam_dist, opt) {
	/* Interpret the local OFF file and draw it on the canvas with the name
	 * 'canvas_id'.
	 *
	 * off_file: local off_file path
	 * canvas_id: the name of the canvas to draw on
	 * cam_dist: the distance of the camera
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 andn
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself is optional too.
	 */
	// Note: will only work if user provided local file himself
	var _opt = {};
	if (opt !== undefined) {
		_opt = opt;
	}
	var reader = new FileReader();
	var result = {};
	reader.onload = function(evt) {
		var data = evt.target.result;
		result.shape = new Shape(data,
			canvas_id,
			cam_dist,
			_opt
		);
	};
	reader.readAsText(off_file);
}

var scene = {
	/* ambient light */
	'light_ambient_r': 0.4,
	'light_ambient_g': 0.4,
	'light_ambient_b': 0.4,

	/* directional light (will be normalized `*/
	'light_dir_1': [-2, 2, -2.5],
	'light_dir_1_r': 0.4,
	'light_dir_1_g': 0.4,
	'light_dir_1_b': 0.35,

	/* directional light (will be normalized `*/
	'light_dir_2': [1.0, -0.5, -1.5],
	'light_dir_2_r': 0.2,
	'light_dir_2_g': 0.2,
	'light_dir_2_b': 0.25,
};

var frag_shader = `
	precision mediump float;

	varying vec4 v_col;
	varying vec3 v_light_weight;

	void main(void) {
		gl_FragColor = vec4(v_light_weight * v_col.rgb, v_col.a);
	}
`;

var vert_shader = `
	attribute vec3 v_pos_attr;
	attribute vec3 norms_attr;
	attribute vec4 v_col_attr;

	uniform mat4 pos_mat;
	uniform mat4 proj_mat;
	uniform mat3 norm_mat;

	uniform vec3 lgt_ambient_col;
	uniform vec3 lgt_dir_1;
	uniform vec3 lgt_dir_1_col;
	uniform vec3 lgt_dir_2;
	uniform vec3 lgt_dir_2_col;

	varying vec4 v_col;
	varying vec3 v_light_weight;

	uniform float scale_f;
	uniform float fade_factor;
	uniform float fade_offset;

	void main(void) {
		vec3 v;
		v.x = scale_f * v_pos_attr.x;
		v.y = scale_f * v_pos_attr.y;
		v.z = scale_f * v_pos_attr.z;
		gl_Position = proj_mat * pos_mat * vec4(v, 1.0);
		v_col = v_col_attr;
		vec3 norm = norm_mat * norms_attr;
		float cos_a = dot(norm, lgt_dir_1);
		// Both sides are visible
		float w_lgt_dir = max(cos_a, -cos_a);
		v_light_weight = lgt_ambient_col + lgt_dir_1_col * w_lgt_dir;
		cos_a = dot(norm, lgt_dir_2);
		w_lgt_dir = max(cos_a, -cos_a);
		v_light_weight += lgt_dir_2_col * w_lgt_dir;
		float light_scale = fade_factor * gl_Position.z/gl_Position.w + fade_offset;
		light_scale = min(1.0, light_scale);
		v_light_weight *= light_scale;
	}
`;

function is_float(n_str) {
	/* for a string representation of a number check whether it is an int, ie. not float */
	return n_str.indexOf(".") > 0;
}

function create_gl_context(canvas) {
	var ctx;
	try {
		ctx = canvas.getContext("webgl", {stencil:true});
		/* fix for Edge, issue 12125200 */
		if (!ctx) {
			ctx = canvas.getContext("experimental-webgl", {stencil:true});
		}
		if (!ctx) {
			console.log('webgl context not supported for your browser / OS / driver');
		} else {
			ctx.my = {};
			ctx.my.viewport_width = canvas.width;
			ctx.my.viewport_height = canvas.height;
		}
	}
	catch (e) {
		console.error('error occurred', e);
	}

	if (!ctx) {
		var tmp = canvas.getContext('2d');
		tmp.font = "bold 20px Arial";
		tmp.fillText("WebGL not supported", 10, 50);
	}

	return ctx;
}

function BaseShape(canvas_id, cam_dist, opt) {
	/* Interpret the specified off-data, and draw it on the canvas with the
	 * name 'canvas_id'.
	 *
	 * off_data: string in .off format that specifies the shape
	 * canvas_id: the name of the canvas to draw on
	 * cam_dist: the distance of the camera
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 andn
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself isn't optional.
	 */
	this.canvas = document.getElementById(canvas_id);
	this.resize_canvas(this.canvas);
	this.gl = create_gl_context(this.canvas);
	/* To support OrbitShape, here just one transform */
	this.gl.my.obj_mats = [mat4.create()];
	this.base = new Object();
	if (this.gl === undefined) {
		return;
	}
	/* rotation while dragging mouse: */
	this.q_drag_rot = quat.create();
	/* current rotation after latest mouse_up: */
	this.q_cur_rot = quat.create();
	this.gl_init(cam_dist, opt);
	this.gl.my.shader_prog = this.get_shader_prog();
}

BaseShape.prototype.resize_canvas = function(canvas) {
	/*
	 * Make the specified canvas size in line with the css Otherwise the
	 * mouse/touch events don't end up at the complete bottom / right. Other
	 * problems are that the 3D shaped is scaled differently in X and Y.
	 */

	// look up the size the canvas is being displayed
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;

	// If it's resolution does not match change it
	if (canvas.width !== width || canvas.height !== height) {
		canvas.width = width;
		canvas.height = height;
	}
}

BaseShape.prototype.paint = function() {
	raf(() => this.on_paint());
}

BaseShape.prototype.xy_to_sphere_pos = function(x, y) {
	var result;

	x = x - this.gl.my.viewport_width/2;
	y = y - this.gl.my.viewport_height/2;
	y = -y;
	var len2 = x * x + y * y;
	if (len2 > this.gl.my.arc_r2) {
		/* rotate around z-axis */
		var scale = Math.sqrt(this.gl.my.arc_r2/len2);
		result = vec3.fromValues(scale * x, scale * y, 0);
	} else {
		/* r^2 = x^2 + y^2 + z^2 */
		result = vec3.fromValues(x, y, Math.sqrt(this.gl.my.arc_r2-len2));
	}
	/* required for quat.rotationTo */
	vec3.normalize(result, result);
	return result;
}

BaseShape.prototype.calc_rotation = function(x, y) {
	var new_sphere_pos = this.xy_to_sphere_pos(x, y);
	var result = quat.create();
	quat.rotationTo(result, this.org_sphere_pos, new_sphere_pos);
	var m = mat3.create()
	mat3.fromQuat(m, result);
	return result;
}

BaseShape.prototype.get_elem_pos = function(evt) {
	var rect = this.canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}

BaseShape.prototype.on_mouse_down = function(evt) {
	if (evt.button != 0) {
		return;
	}
	var pos = this.get_elem_pos(evt);
	if (evt.shiftKey) {
		this.zooming = true;
		this.zoom_org = pos.y;
		this.org_scale = this.gl.my.scale_f;
	} else {
		this.rotating = true;
		this.org_sphere_pos = this.xy_to_sphere_pos(pos.x, pos.y);
	}
}

BaseShape.prototype.zoom = function(zoom_new, pull_up) {
	/*
	 * pull_up: true means for mouse that plane throttle operation is used.
	 *          Set to false for the opposite. For touch, the logical way
	 *          would be to set to false. That way a bigger distance between
	 *          the fingers will mean zoom in.
	 */
	var dz = zoom_new - this.zoom_org;
	if (pull_up) {
		dz = -dz;
	}
	dz = 1 + dz * this.gl.my.zoom_scale;
	/* don't continue at scaling 0 or even negative scaling */
	if (dz > 0) {
		this.gl.my.scale_f = dz * this.org_scale;
	}
}

BaseShape.prototype.on_mouse_move = function(evt) {
	var pos = this.get_elem_pos(evt);
	if (this.rotating) {
		this.q_drag_rot = this.calc_rotation(pos.x, pos.y);
	} else if (this.zooming) {
		this.zoom(pos.y, true);
	} else {
		return;
	}
	this.paint();

	return false;
}

BaseShape.prototype.set_cur_rot = function(q_drag) {
	/*
	 * Set new current orientation from dragging rotation (quat)
	 */
	quat.mul(this.q_cur_rot, q_drag, this.q_cur_rot);
	mat4.fromRotationTranslation(
		this.gl.my.pos_mat,
		this.q_cur_rot, [0.0, 0.0, -this.gl.my.cam_dist]);
}

BaseShape.prototype.on_mouse_up = function(evt) {
	/*
	 * Since mouse_up event is caught even outside the canvas, while
	 * rotating/zooming is only caught inside the canvas, it can
	 * happen that this event is received without an initial
	 * rotating/zooming
	 */
	var pos = this.get_elem_pos(evt);
	if (this.rotating) {
		var q_drag = this.calc_rotation(pos.x, pos.y);
		this.set_cur_rot(q_drag);
	} else if (this.zooming) {
		this.zoom(pos.y, true);
	} else {
		return;
	}
	this.reset_mouse();
	this.paint();
}

BaseShape.prototype.reset_mouse = function() {
	this.rotating = false;
	this.zooming = false;
	this.zoom_org = 0;
}

BaseShape.prototype.on_wheel = function(evt) {
	evt.preventDefault();
	var F = 500.0; /* some constant that worked for my mouse */
	var dz = (F - evt.deltaY) / F;
	this.gl.my.scale_f = dz * this.gl.my.scale_f;
	this.paint();
}

BaseShape.prototype.touch_end_rotate = function() {
	/* check whether a touch_move was really handled: */
	if (this.q_drag_rot) {
		this.set_cur_rot(this.q_drag_rot);
	}
	this.rotating = false;
}

BaseShape.prototype.touch_end_zoom = function() {
	this.zooming = false;
	this.zoom_org = 0;
}

BaseShape.prototype.touch_dist = function(t0, t1) {
	var pos0 = this.get_elem_pos(t0);
	var pos1 = this.get_elem_pos(t1);
	var v0 = vec2.fromValues(pos0.x, pos0.y);
	var v1 = vec2.fromValues(pos1.x, pos1.y);
	return vec2.dist(v1, v0);
}

BaseShape.prototype.on_touch_start = function(evt) {
	evt.preventDefault();

	switch (evt.touches.length) {
	case 1:
		this.rotating = true;
		var pos = this.get_elem_pos(evt.touches[0]);
		this.q_drag_rot = undefined;
		this.org_sphere_pos = this.xy_to_sphere_pos(pos.x, pos.y);
		break;
	case 2:
		if (this.rotating) {
			this.touch_end_rotate();
		}
		this.zooming = true;
		this.zoom_org = this.touch_dist(evt.touches[0], evt.touches[1]);
		this.org_scale = this.gl.my.scale_f;
		break;
	case 3:
		console.log('Undo all zoom/rotation');
		if (this.rotating) {
			this.touch_end_rotate();
		}
		if (this.zooming) {
			this.touch_end_zoom();
		}
		this.gl_reset_view();
		this.paint();
		break;
	default:
		if (this.rotating) {
			this.touch_end_rotate();
		}
		if (this.zooming) {
			this.touch_end_zoom();
		}
		break;
	}
}

BaseShape.prototype.on_touch_move = function(evt) {
	switch (evt.touches.length) {
	case 1:
		/* when touches.length changes from 1 -> 2 -> 1:
		 * this.rotating == false (which is expected behaviour)
		 */
		if (this.rotating) {
			var pos = this.get_elem_pos(evt.touches[0]);
			this.q_drag_rot =
				this.calc_rotation(pos.x, pos.y);
		}
		break;
	case 2:
		/* when touches.length changes from 2 -> 3 -> 2:
		 * this.zooming == false (which is expected behaviour)
		 */
		if (this.zooming) {
			this.zoom(
				this.touch_dist(evt.touches[0], evt.touches[1]),
				false
			);
		}
		break;
	default:
		/* ignore, not supported */
		break;
	}
	this.paint();
}

BaseShape.prototype.on_touch_end = function(evt) {
	if (this.rotating) {
		/* save the last known rotation.
		 * Note that this isn't entirely correct. It is better to take
		 * the position from the changedTouches (should be 1), but this
		 * is easier:
		 */
		this.touch_end_rotate();
	}
	if (this.zooming) {
		this.touch_end_zoom();
	}
	this.paint();
}

BaseShape.prototype.gl_reset_view = function(cam_dist) {
	var gl = this.gl;
	quat.identity(this.q_cur_rot);
	mat4.identity(gl.my.pos_mat);
	mat4.translate(
		gl.my.pos_mat, gl.my.pos_mat, [0.0, 0.0, -gl.my.cam_dist]);
	gl.my.scale_f = 1.0;
}

var KC_5 = 53;
var KC_C = 67;
var KC_F = 70; /* toggle show faces: (reserved, TODO) */
var KC_E = 69; /* toggle show edges: (reserved, TODO) */
var KC_V = 86; /* toggle show vertices: (reserved, TODO) */

BaseShape.prototype.on_key_down = function(evt) {
	/*
	 *             5: reset to original position
	 *       SHIFT 5: reset zoom
	 * ALT + SHIFT 5: reset rotate
	 */
	var gl = this.gl;
	if (!evt.shiftKey && !evt.altKey) {
		/* No SHIFT and no ALT */
		switch (evt.keyCode) {
		case KC_5:
			console.log('Undo all zoom/rotation');
			this.gl_reset_view();
			this.paint();
			break;
		case KC_C:
			if (gl.my.use_stencil_buffer) {
				console.log('Support for convex faces only');
				gl.my.use_stencil_buffer = false;
				gl.disable(gl.STENCIL_TEST);
			} else {
				console.log('Support for concave faces');
				gl.my.use_stencil_buffer = true;
				gl.enable(gl.STENCIL_TEST);
			}
			this.paint();
			break;
		}
	} else if (evt.shiftKey && !evt.altKey) {
		/* Only SHIFT */
		switch (evt.keyCode) {
		case KC_5:
			console.log('Undo all zoom');
			gl.my.scale_f = 1.0;
			this.paint();
			break;
		}
	} else if (!evt.shiftKey && evt.altKey) {
		/* Only ALT */
	} else {
		/* Both ALT and SHIFT */
		switch (evt.keyCode) {
		case KC_5:
			console.log('Undo all rotation');
			quat.identity(this.q_cur_rot);
			mat4.identity(gl.my.pos_mat);
			mat4.translate(
				gl.my.pos_mat, gl.my.pos_mat, [0.0, 0.0, -gl.my.cam_dist]);
			this.paint();
			break;
		}
	}
}

BaseShape.prototype.on_key_up = function(evt) {
}

BaseShape.prototype.input_init = function(cam_dist) {
	this.reset_mouse();
	var this_ = this
	this.canvas.onmousedown = function(evt) {
		this_.on_mouse_down(evt);
	}
	// Register move and release even outside the canvas
	document.addEventListener('mouseup', function(evt) {
		this_.on_mouse_up(evt);
	});
	document.addEventListener('mousemove', function(evt) {
		this_.on_mouse_move(evt);
	});
	document.addEventListener('keydown', function(evt) {
		this_.on_key_down(evt);
	});
	this.canvas.onkeyup = function(evt) {
		this_.on_key_up(evt);
	}
	this.canvas.addEventListener('touchstart', function(evt) {
		this_.on_touch_start(evt);
	});
	this.canvas.addEventListener('touchmove', function(evt) {
		this_.on_touch_move(evt);
	});
	this.canvas.addEventListener('touchend', function(evt) {
		this_.on_touch_end(evt);
	});
	this.canvas.addEventListener('wheel', function(evt) {
		this_.on_wheel(evt);
	});
}

BaseShape.prototype.update_bgcol = function(col) {
	var gl = this.gl;
	gl.clearColor(col[0], col[1], col[2], 1.0);
	this.paint();
}

BaseShape.prototype.gl_init = function(cam_dist, opt) {
	/*
	 * cam_dist: the distance of the camera
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 andn
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself isn't.
	 */
	var gl = this.gl;
	/*
	 * proj_mat: related to camera projection
	 * pos_mat: related to the position of all object due to user navigation
	 * obj_mats: related to copies of object through transform
	 */
	gl.my.proj_mat = mat4.create();
	gl.my.pos_mat = mat4.create();
	gl.my.cam_dist = cam_dist;
	gl.my.fade_factor = 0.0;
	gl.my.fade_offset = 1.0;
	this.gl_reset_view();

	var r = ARC_SCALE * Math.min(gl.my.viewport_width, gl.my.viewport_height) / 2;
	gl.my.zoom_scale = 2.0 / Math.max(gl.my.viewport_width, gl.my.viewport_height);
	gl.my.arc_r2 = r*r;

	if ('bg_col' in opt) {
		gl.clearColor(opt.bg_col[0], opt.bg_col[1], opt.bg_col[2], 1.0);
	} else {
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
	}
	gl.enable(gl.DEPTH_TEST);
	if ('has_concave_faces' in opt && opt.has_concave_faces) {
		// Use stencil buffer for pentagrams, e.g.
		gl.enable(gl.STENCIL_TEST);
		gl.my.use_stencil_buffer = opt.has_concave_faces;
	} else {
		gl.disable(gl.STENCIL_TEST);
		gl.my.use_stencil_buffer = false;
	}
	gl.clearStencil(0);
	gl.stencilMask(1);
}

BaseShape.prototype.compile_shader = function(shader, prog) {
	var gl = this.gl;
	gl.shaderSource(shader, prog);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw prog + ":\n" + gl.getShaderInfoLog(shader);
	}
}

BaseShape.prototype.compile_f_shader = function(prog) {
	var shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
	this.compile_shader(shader, prog);
	return shader;
}

BaseShape.prototype.compile_v_shader = function(prog) {
	var shader = this.gl.createShader(this.gl.VERTEX_SHADER);
	this.compile_shader(shader, prog);
	return shader;
}

BaseShape.prototype.get_shader_prog = function() {
	var gl = this.gl;

	var f_shader = this.compile_f_shader(frag_shader);
	var v_shader = this.compile_v_shader(vert_shader);

	var shader_prog = gl.createProgram();
	gl.attachShader(shader_prog, v_shader);
	gl.attachShader(shader_prog, f_shader);
	gl.linkProgram(shader_prog);

	if (!gl.getProgramParameter(shader_prog, gl.LINK_STATUS)) {
		throw "Error initialising shaders";
	}

	gl.useProgram(shader_prog);

	shader_prog.v_pos_attr = gl.getAttribLocation(shader_prog, "v_pos_attr");
	gl.enableVertexAttribArray(shader_prog.v_pos_attr);

	shader_prog.norms_attr = gl.getAttribLocation(shader_prog, "norms_attr");
	gl.enableVertexAttribArray(shader_prog.norms_attr);

	shader_prog.v_col_attr = gl.getAttribLocation(shader_prog, "v_col_attr");
	gl.enableVertexAttribArray(shader_prog.v_col_attr);

	shader_prog.scale_f = gl.getUniformLocation(shader_prog, "scale_f");
	shader_prog.proj_mat = gl.getUniformLocation(shader_prog, "proj_mat");
	shader_prog.pos_mat = gl.getUniformLocation(shader_prog, "pos_mat");
	shader_prog.norm_mat = gl.getUniformLocation(shader_prog, "norm_mat");
	shader_prog.fade_factor = gl.getUniformLocation(shader_prog, "fade_factor");
	shader_prog.fade_offset = gl.getUniformLocation(shader_prog, "fade_offset");

	shader_prog.lgt_ambient_col = gl.getUniformLocation(shader_prog,
							"lgt_ambient_col");
        shader_prog.lgt_dir_1 = gl.getUniformLocation(shader_prog,
							"lgt_dir_1");
        shader_prog.lgt_dir_1_col = gl.getUniformLocation(shader_prog,
							"lgt_dir_1_col");
        shader_prog.lgt_dir_2 = gl.getUniformLocation(shader_prog,
							"lgt_dir_2");
        shader_prog.lgt_dir_2_col = gl.getUniformLocation(shader_prog,
							"lgt_dir_2_col");

	return shader_prog;
}

BaseShape.prototype.get_face_normal = function(n, f) {
	var d1 = vec3.create();
	var d2 = vec3.create();
	var v0 = this.base.Vs[f[0]]
	var v1;
	var ll1;
	var i;
	var min = 1e-10;
	for (i = 1; i < f.length - 1; i++) {
		v1 = this.base.Vs[f[i]];
		vec3.subtract(d1, v1, v0);
		ll1 = vec3.sqrLen(d1);
		if (ll1 > min) {
			break;
		}
	}
	var v2;
	var ll2;
	for (var j = i + 1; j < f.length; j++) {
		v2 = this.base.Vs[f[j]];
		vec3.subtract(d2, v2, v0);
		ll2 = vec3.sqrLen(d1);
		if (ll2 > min) {
			break;
		}
	}
	if ((ll1 <= min) || (ll2 <= min)) {
		console.log(' Warning problems calculating face normal', ll1, ll2);
	}
	vec3.cross(n, d1, d2);
	vec3.normalize(n, n);
	return n;
}

BaseShape.prototype.triangulate = function() {
	/*
	 * Divide all the faces in this.base.Fs, this.base.Vs and this.cols into
	 * triangles and save in the result in this.gl.my.vs, this.gl.my.v_cols,
	 * this.gl.my.fs and this.gl.my.ffs.
	 *
	 * this: should contain:
	 *        - base.Vs: array of vertices, each element is a 3 dimensional
	 *          array of floats.
	 *        - base.Fs: array of faces. Each face consists of indices of Vs
	 *          in a counter-clockwise order.
	 *        - cols: array of array of face colors. The first index refers
	 *                to the index of the copy of the base shape. The second
	 *                refers to the face with the same index in Fs has the
	 *                specified colour. Each colour is an array of RGB
	 *                values 0 <= colour <= 1.
	 *        - gl.my.obj_mats: an array of 4x4 transform matrices
	 *                          expressing the copied of the base shape.
	 *                          Only the length is used here.
	 *
	 * Note: this.base.mat doesn't need to be defined at this stage. This
	 * is important, since updating this base.mat doesn't require to rerun
	 * this triangulate function.
	 *
	 * Result:
	 *        this.gl.my.vs: an OpenGL vertex buffer object with the fields
	 *            elem_len and no_of_elem. The latter expresses the amount
	 *            of vertices, the former the length per vertex.
	 *        this.gl.my.v_cols: an OpenGL vertex colour buffer object with
	 *            the fields elem_len and no_of_elem. The latter expresses
	 *            the amount of vertices times the amount of copies of the
	 *            base shape, the former the length per vertex.
	 *        this.gl.my.ns: an OpenGL normals buffer object with the fields
	 *            elem_len and no_of_elem that specifies the normal to be
	 *            used for that vertex.
	 *        this.gl.my.ffs: an array of OpenGL face buffer objects with the
	 *            fields elem_len and no_of_elem. The latter expresses the
	 *            amount of face indices, the former the length per index
	 *            (i.e. 1). Each triplet forms one triangle. Each buffer
	 *            object is one face. The reason that not all triangles are
	 *            in one buffer here is in case a stencil buffer is used,
	 *            faces need to be stencilled per face.
	 *        this.gl.my.fs: an OpenGL face buffer object with the fields
	 *            elem_len  and no_of_elem. The latter expresses the amount
	 *            of face indices, the former the length per index (i.e. 1).
	 *            Each triplet forms a triangle. This buffer can be used if
	 *            no stencil buffer is used.
	 */
	var gl = this.gl
	var fs = [];
	var vs = [];
	var ns = [];
	var cols = [];
	var no_vs = 0;
	gl.my.ffs = [];
	for (var j = 0; j < this.base.Fs.length; j++) {
		var f = this.base.Fs[j];
		var n = vec3.create();
		this.get_face_normal(n, f);
		for (var i = 0; i < f.length; i++) {
			vs = vs.concat(this.base.Vs[f[i]]);
			/* convert to std Array, otherwise concat doesn't work */
			ns = ns.concat(Array.prototype.slice.call(n));
		}
		var f3s = []; // triangulated face
		for (var i = 1; i < f.length - 1; i++) {
			// i+1 before i, to keep clock-wise direction
			f3s = f3s.concat([no_vs, no_vs + i + 1, no_vs + i]);
		}
		no_vs += f.length;
		fs = fs.concat(f3s);

		var gl_fs= gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl_fs);
		gl.bufferData(
			gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(f3s),
			gl.STATIC_DRAW);
		gl_fs.elem_len = 1;
		gl_fs.no_of_elem = f3s.length;
		gl.my.ffs.push(gl_fs);
	}
	for (var k = 0; k < gl.my.obj_mats.length; k++) {
		for (var j = 0; j < this.base.Fs.length; j++) {
			for (var i = 0; i < this.base.Fs[j].length; i++) {
				cols = cols.concat(this.cols[k][j]);
			}
		}
	}

	gl.my.vs = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vs);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vs), gl.STATIC_DRAW);
	gl.my.vs.elem_len = 3;
	gl.my.vs.no_of_elem = no_vs;

	gl.my.v_cols = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.v_cols);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.STATIC_DRAW);
	gl.my.v_cols.elem_len = 4;
	gl.my.v_cols.no_of_elem = no_vs;

	gl.my.ns = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.ns);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ns), gl.STATIC_DRAW);
	gl.my.ns.elem_len = 3;
	gl.my.ns.no_of_elem = no_vs;

	gl.my.fs = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.my.fs);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(fs), gl.STATIC_DRAW);
	gl.my.fs.elem_len = 1;
	gl.my.fs.no_of_elem = fs.length;
}

BaseShape.prototype.calc_pos_mat = function() {
	if (this.rotating) {
		var q;
		q = quat.create();
		quat.mul(q, this.q_drag_rot, this.q_cur_rot);
		mat4.fromRotationTranslation(
			this.gl.my.pos_mat, q, [0.0, 0.0, -this.gl.my.cam_dist]);
	}
}

BaseShape.prototype.calc_min_depth = function() {
	var gl = this.gl;
	var z_min = 1;

	/* TODO: get max R value and add to cam_dist (+ some margin) */
	mat4.perspective(gl.my.proj_mat,
		45.0*DEG2RAD, gl.my.viewport_width / gl.my.viewport_height, 0.1, 4*gl.my.cam_dist);
	this.calc_pos_mat();

	for (var k = 0; k < gl.my.obj_mats.length; k++) {
		var obj_mat = mat4.create();
		mat4.multiply(obj_mat, gl.my.obj_mats[k], this.base.mat);
		mat4.multiply(obj_mat, gl.my.pos_mat, obj_mat);
		mat4.multiply(obj_mat, gl.my.proj_mat, obj_mat);

		mat4.mul(obj_mat, gl.my.proj_mat, gl.my.pos_mat);
		for (var ii = 0; ii < this.base.Vs.length; ii++) {
			var v3 = this.base.Vs[ii];
			var v4 = vec4.fromValues(v3[0], v3[1], v3[2], 1.0);
			vec4.transformMat4(v4, v4, obj_mat);
			var z_c = v4[2]/v4[3]
			if (z_c < z_min) {
				z_min = z_c;
			}
		}
	}
	/* TODO: make config min_factor, which should be in [0; 1]? */
	var min_factor = 0.01;
	/*
	 *            |
	 *          1 +----- .
	 *            |       \
	 *            |        \
	 *            |         \
	 *            |          \
	 * min_factor +           .
	 *            |
	 *            +------+----+----
	 *           O   z_min    1.0
	 */
	gl.my.fade_factor = (min_factor - 1.0) / (1.0 - z_min);
	gl.my.fade_offset = min_factor - gl.my.fade_factor;
}

BaseShape.prototype.draw = function() {
	var gl = this.gl;

	this.calc_pos_mat();
	gl.viewport(0, 0, gl.my.viewport_width, gl.my.viewport_height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.uniform1f(gl.my.shader_prog.fade_factor, gl.my.fade_factor);
	gl.uniform1f(gl.my.shader_prog.fade_offset, gl.my.fade_offset);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vs);
	gl.vertexAttribPointer(gl.my.shader_prog.v_pos_attr,
		gl.my.vs.elem_len, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.ns);
	gl.vertexAttribPointer(gl.my.shader_prog.norms_attr,
		gl.my.ns.elem_len, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.v_cols);

	gl.uniform1f(gl.my.shader_prog.scale_f, gl.my.scale_f);
	gl.uniformMatrix4fv(gl.my.shader_prog.proj_mat, false, gl.my.proj_mat);

	gl.uniform3f(gl.my.shader_prog.lgt_ambient_col,
		 scene['light_ambient_r'],
		 scene['light_ambient_g'],
		 scene['light_ambient_b']);
	/* incoming light -> source of light */
	var light_dir_1 = vec3.create();
	vec3.normalize(light_dir_1, scene['light_dir_1']);
	vec3.scale(light_dir_1, light_dir_1, -1);
	gl.uniform3fv(gl.my.shader_prog.lgt_dir_1, light_dir_1);
	gl.uniform3f(
		gl.my.shader_prog.lgt_dir_1_col,
		scene['light_dir_1_r'],
		scene['light_dir_1_g'],
		scene['light_dir_1_b']);
	var light_dir_2 = vec3.create();
	vec3.normalize(light_dir_2, scene['light_dir_2']);
	vec3.scale(light_dir_2, light_dir_2, -1);
	gl.uniform3fv(gl.my.shader_prog.lgt_dir_2, light_dir_2);
	gl.uniform3f(
		gl.my.shader_prog.lgt_dir_2_col,
		scene['light_dir_2_r'],
		scene['light_dir_2_g'],
		scene['light_dir_2_b']);

	for (var k = 0; k < gl.my.obj_mats.length; k++) {
		var obj_mat = mat4.create();
		mat4.multiply(obj_mat, gl.my.obj_mats[k], this.base.mat);
		mat4.multiply(obj_mat, gl.my.pos_mat, obj_mat);
		gl.uniformMatrix4fv(gl.my.shader_prog.pos_mat, false, obj_mat);

		var norm_mat = mat3.create();
		mat3.normalFromMat4(norm_mat, obj_mat);
		gl.uniformMatrix3fv(gl.my.shader_prog.norm_mat, false, norm_mat);

		/* 4 * 4 offset number of vertices, since:
		 * - 4 bytes per float
		 * - 4 colour channels per vertex
		 *  */
		gl.vertexAttribPointer(gl.my.shader_prog.v_col_attr,
			gl.my.v_cols.elem_len, gl.FLOAT, false, 0,
			16 * gl.my.vs.no_of_elem* k);
		if (gl.my.use_stencil_buffer) {
			/* Now draw each face with stencil buffer */
			for (var i = 0; i < gl.my.ffs.length; i++) {
				var f = gl.my.ffs[i];
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, f);

				// For the stencil buffer
				gl.clear(gl.STENCIL_BUFFER_BIT);
				gl.colorMask(false, false, false, false);
				gl.depthMask(false);
				// always pass stencil test
				gl.stencilFunc(gl.ALWAYS, 1, 1);
				// stencil fail: don't care, never fails
				// z-fail: zero (don't care, depthMask = false)
				// both pass: invert stencil values
				gl.stencilOp(gl.KEEP, gl.ZERO, gl.INVERT);
				// Create triangulated stencil:
				gl.drawElements(gl.TRIANGLES, f.no_of_elem,
								gl.UNSIGNED_SHORT, 0);

				// reset colour and depth settings
				gl.depthMask(true);
				gl.colorMask(true, true, true, true);
				// Draw only where stencil equals 1 (masked to 1)
				// gl.INVERT was used, i.e. in case of e.g. 8 bits the
				// value is either 0 or 0xff, but only the last bit is
				// checked.
				gl.stencilFunc(gl.EQUAL, 1, 1);
				gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
				// Use triangulated stencil:
				gl.drawElements(gl.TRIANGLES, f.no_of_elem,
								gl.UNSIGNED_SHORT, 0);
			}
		} else {
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.my.fs);
			gl.drawElements(gl.TRIANGLES, gl.my.fs.no_of_elem,
								gl.UNSIGNED_SHORT, 0);
		}
	}
}

BaseShape.prototype.first_paint = function() {
	this.triangulate();
	this.on_paint();
	this.input_init();
}

BaseShape.prototype.on_paint = function() {
	this.calc_min_depth();
	this.draw();
}

/*
 * Shape is used to show OFF files
 */
function Shape(off_data, canvas_id, cam_dist, opt) {
	BaseShape.call(this, canvas_id, cam_dist, opt);

	this.get_off_shape(off_data);
	this.first_paint();
}

// Inherit from BaseShape
Shape.prototype = Object.create(BaseShape.prototype);

Shape.prototype.get_off_shape = function(data) {
	var states = {
		'checkOff': 0,
		'readSizes': 1,
		'readVs': 2,
		'readFs': 3,
		'readOk': 4
	};
	var nrRead = 0;
	var nrRealFaces = 0;
	var state = states.checkOff;
	var lines = data.split('\n');
	var error = false
	for (var i = 0; i < lines.length; i++) {
		if (!lines[i].match(/\s*(#)/) && lines[i] != "") {
			var words = lines[i].match(/\s*(\S+)/g)
			switch (state) {
			case states.checkOff:
				error = words[0] != 'OFF';
				if (!error) {
					state = states.readSizes;
					console.log('OFF file format recognised')
				} else {
					console.error("file should start with keyword 'OFF'");
				}
				break;
			case states.readSizes:
				var nrOfVs = parseInt(words[0]);
				var nrOfFs = parseInt(words[1]);
				var nrOfEs = parseInt(words[2]);
				this.base.Vs = new Array(nrOfVs);
				this.base.Fs = new Array(nrOfFs);
				this.base.Es = [];
				/*
				 * array of array to support OrbitShape:
				 * here one transfor, ie. one set of colours
				 */
				this.cols = [new Array(nrOfFs)];
				console.log('reading', nrOfVs,
					'Vs', nrOfFs, 'Fs (', nrOfEs, 'edges)');
				state = states.readVs;
				break;
			case states.readVs:
				error = words.length < 3;
				if (!error) {
					this.base.Vs[nrRead] = [
						parseFloat(words[0]),
						parseFloat(words[1]),
						parseFloat(words[2])];
					nrRead += 1;
					if (nrRead >= this.base.Vs.length) {
						state = states.readFs;
						nrRead = 0;
					}
				} else {
					console.error('error reading vertex', nrRead);
				}
				break;
			case states.readFs:
				var n = parseInt(words[0]);
				error = (words.length != n + 1) && (
					words.length != n + 4);
				if (!error) {
					var face = new Array(n);
					for (var j = 0; j < n; j++) {
						face[j] = parseInt(words[j+1]);
					}
					if (n >= 3) {
						this.base.Fs[nrRead] = face;
						var col = new Array(3);
						if (words.length == n + 1) {
							col = [0.8, 0.8, 0.8];
						} else {
							for (var j = 0; j < 3; j++) {
								var s_chl = words[n+1+j];
								var chl = s_chl * 1;
								if (is_float(s_chl)) {
									col[j] = chl;
								} else {
									col[j] = chl / 255;
								}
							}
						}
						// add alpha = 1
						col.push(1);
						this.cols[0][nrRead] = col;
						nrRealFaces += 1;
					} else if (n == 2) {
						this.base.Es.push(face);
					} // else ignore, but count
					nrRead += 1;
					if (nrRead >= this.base.Fs.length) {
						state = states.readOk;
						console.log('Done reading OFF file');
						nrRead = 0;
					}
				} else {
					console.error('error reading face', nrRead);
					console.log(words.length, '!=', n+1, 'or', n+4);
				}
				break;
			}
			if (error) {
				break;
			}
		}
	}
	this.base.mat = mat4.create();
	if (state != states.readOk) {
		throw 'Error reading OFF file';
	}
	this.base.Fs = this.base.Fs.slice(0, nrRealFaces);
}

function to_mat4(m) {
	return mat4.fromValues(
		m[0][0], m[0][1], m[0][2], m[0][3],
		m[1][0], m[1][1], m[1][2], m[1][3],
		m[2][0], m[2][1], m[2][2], m[2][3],
		m[3][0], m[3][1], m[3][2], m[3][3]);
}

/*
 * OrbitShape is used to show base shape with copies by isometries
 */
function OrbitShape(descriptive, transforms, canvas_id, cam_dist, opt) {
	/* Create a 3D shape based on isometry operations.
	 *
	 * descriptive: object with properties Vs, Fs and transform:
	 *              descriptive.Vs: the 3D coordinates of the vertices of
	 *                              the descriptive
	 *              descriptive.Fs: which vertex indices that need to be
	 *                              connected to get the faces of the
	 *                              descriptive.
	 *              descriptive.transform: a 4x4 matrix defining the
	 *                                     transform. the is applied to the
	 *                                     descriptive. The matrix is
	 *                                     defined in rows and columns.
	 * transforms: An array of 4x4 matrices. These will all be applied onto
	 *             the descriptive after the initial transform. Each
	 *             transform will also contain a property field col, which
	 *             is an array of 3 elements between 0 and 1 defining the
	 *             RGB colour of the transformed shape.
	 * For the other parameters, see draw_shape.
	 */
	BaseShape.call(this, canvas_id, cam_dist, opt);

	this.base = new Object()
	this.base.Vs = descriptive.Vs;
	this.base.Fs = descriptive.Fs;
	this.base.mat = to_mat4(descriptive.transform);

	this.gl.my.obj_mats = new Array(transforms.length);
	this.cols = new Array(transforms.length);
	for (var i = 0; i < transforms.length; i++) {
		this.gl.my.obj_mats[i] =to_mat4(transforms[i])
		this.cols[i] = new Array(this.base.Fs.length);
		var col = transforms[i].col.slice();
		// add alpha channel = 1
		col.push(1);
		for (var j = 0; j < this.base.Fs.length; j++) {
			this.cols[i][j] = col;
		}
	}
	this.first_paint();
}

// Inherit from BaseShape
OrbitShape.prototype = Object.create(BaseShape.prototype);

OrbitShape.prototype.rotate_descriptive = function(axis, rad) {
	if (typeof rad === 'undefined' || typeof axis === 'undefined') {
		return;
	}
	mat4.fromRotation(this.base.mat, rad, axis);
	this.paint();
}

/*
 * MorphShape is used to show base shape with copies by isometries
 */
function MorphShape(descriptive, canvas_id, cam_dist, opt) {
	/* Create a 3D shape for which vertices can morph linearly
	 *
	 * descriptive: object with properties Vs, Fs and transform:
	 *              descriptive.vs_0: the 3D coordinates of the initial
	 *                                vertices of the descriptive. vs_0 and
	 *                                dvs should have the same length.
	 *              descriptive.dvs: the 3D vector so that vs_0 + dvs gives
	 *                               the final vertices of the descriptive.
	 *                               vs_0 and dvs should have the same
	 *                               length.
	 *              descriptive.Fs: which vertex indices that need to be
	 *                              connected to get the faces of the
	 *                              descriptive.
	 *              descriptive.cols: defines the RGB colour for each face.
	 *                                Each colour channel value is part of
	 *                                [0, 255]
	 * For the other parameters, see draw_shape.
	 */
	BaseShape.call(this, canvas_id, cam_dist, opt);

	this.base = new Object()
	this.base.vs_0 = descriptive.vs_0;
	this.base.dvs = descriptive.dvs;
	this.base.Vs = [new Array(descriptive.vs_0.length)];
	for (var i = 0; i < descriptive.vs_0.length; i++) {
		//this.base.Vs[i] = vec3.create();
		this.base.Vs[i] = [new Array(3)];
		vec3.copy(this.base.Vs[i], descriptive.vs_0[i]);
	}
	this.base.Fs = descriptive.fs;
	this.base.mat = mat4.create();
	this.cols = [new Array(descriptive.fs.length)];
	this.gl.my.obj_mats = [mat4.create()];
	for (var i = 0; i < descriptive.fs.length; i++) {
		this.cols[0][i] = new Array(4);
		for (var j = 0; j < 3; j++) {
			this.cols[0][i][j] = descriptive.cols[i][j] / 255;
		}
		// set alpha channel
		this.cols[0][i][3] = 1;
	}
	this.first_paint();
}

// Inherit from BaseShape
MorphShape.prototype = Object.create(BaseShape.prototype);

MorphShape.prototype.morph_descriptive = function(s) {
	if (typeof s === 'undefined') {
		return;
	}
	var dv = vec3.create();
	for (var i = 0; i < this.base.Vs.length; i++) {
		vec3.scale(dv, this.base.dvs[i], s);
		vec3.add(this.base.Vs[i], this.base.vs_0[i], dv);
	}
	this.triangulate();
	this.paint();
}

global.draw_local_shape = draw_local_shape;
global.draw_shape = draw_shape;
global.draw_url_shape = draw_url_shape;
global.OrbitShape = OrbitShape;
global.MorphShape = MorphShape;

// vim: noexpandtab: sw=8
