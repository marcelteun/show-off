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
	draw_url_shape,
	draw_local_shape,
	draw_shape,
	OrbitShape,
	MorphShape
};

var DEG2RAD = Math.PI/360;
var ARC_SCALE = 0.8; /* limit to switch rotation type for mouse */
var PANEL_BUTTON_WIDTH = 48;
var EDGE_RADIUS = 0.012; /* radius of displayed edge cylinders */
var VERTEX_RADIUS = 0.028; /* radius of displayed vertex spheres */
var MARKER_SEGMENTS = 8; /* radial and spherical subdivisions for markers */

function draw_url_shape(off_url, canvas, opt, on_doc) {
	/* Retrieve the specified off-file, interpret the file and draw it on
	 * the specified canvas element
	 *
	 * off_url: the complete url including the protocol.
	 * canvas: the canvas node object to draw on
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 and
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself is optional too.
	 * on_doc: optional document object. If undefined then the current
	 *  document is used. If the the canvas is on another document then this
	 *  parameter is needed as well.
	 */
	var result = {};
	var _opt = {};
	if (opt !== undefined) {
		_opt = opt;
	}

	fetch(off_url).then(function(response) {
		if (!response.ok) {
			throw new Error("HTTP status " + response.status);
		}
		return response.text();
	}).then(function(data) {
		result.shape = new Shape(data, canvas, _opt, on_doc);
	})
	.catch(function(error) {
		console.error("error fetching", off_url, error);
	});

	return result;
}

function draw_shape(off_file, canvas, opt, on_doc) {
	/* Retrieve the specified off-file, interpret the file and draw it on
	 * the specified canvas element.
	 *
	 * off_file: relative path of the off file.
	 * canvas: the canvas node object to draw on
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 and
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself is optional too.
	 * on_doc: optional document object. If undefined then the current
	 *  document is used. If the the canvas is on another document then this
	 *  parameter is needed as well.
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
		result = draw_url_shape(off_url, canvas, _opt, on_doc);
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
					result.shape = new Shape(
						req.responseText, canvas, _opt
					);
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

function draw_local_shape(off_file, canvas, opt, on_doc) {
	/* Interpret the local OFF file and draw it on the specified canvas element.
	 *
	 * off_file: local off_file path
	 * canvas: the canvas node object
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 andn
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself is optional too.
	 * on_doc: optional document object. If undefined then the current
	 *  document is used. If the the canvas is on another document then this
	 *  parameter is needed as well.
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
		result.shape = new Shape(data, canvas, _opt, on_doc);
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
	uniform float fade_min;

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
		light_scale = max(fade_min, light_scale);
		v_light_weight *= light_scale;
	}
`;

function is_float(n_str) {
	/* for a string representation of a number check whether it is an int, ie. not float */
	return n_str.indexOf(".") > 0;
}

/*
 * Append one marker vertex, normal, and neutral color to the shared buffers.
 */
function marker_vertex(data, position, normal) {
	for (var i = 0; i < 3; i++) {
		data.vertices.push(position[i]);
		data.normals.push(normal[i]);
	}
	data.colors.push(0.8, 0.8, 0.8, 1);
}

/*
 * Append a triangle with per-vertex normals to the shared marker buffers.
 */
function marker_triangle(data, points, normals) {
	for (var i = 0; i < 3; i++) {
		marker_vertex(data, points[i], normals[i]);
	}
}

/*
 * Add a cylinder between two model-space endpoints to the marker buffers.
 */
function add_cylinder(data, a, b) {
	var axis = vec3.create();
	vec3.subtract(axis, b, a);
	if (vec3.squaredLength(axis) < 1e-12) {
		return;
	}
	vec3.normalize(axis, axis);
	var ref = Math.abs(axis[1]) < 0.9 ?
		vec3.fromValues(0, 1, 0) : vec3.fromValues(1, 0, 0);
	var u = vec3.create();
	var v = vec3.create();
	vec3.cross(u, axis, ref);
	vec3.normalize(u, u);
	vec3.cross(v, axis, u);
	for (var i = 0; i < MARKER_SEGMENTS; i++) {
		var angle0 = 2 * Math.PI * i / MARKER_SEGMENTS;
		var angle1 = 2 * Math.PI * (i + 1) / MARKER_SEGMENTS;
		var n0 = vec3.create();
		var n1 = vec3.create();
		vec3.scale(n0, u, Math.cos(angle0));
		vec3.scaleAndAdd(n0, n0, v, Math.sin(angle0));
		vec3.scale(n1, u, Math.cos(angle1));
		vec3.scaleAndAdd(n1, n1, v, Math.sin(angle1));
		var a0 = vec3.create();
		var b0 = vec3.create();
		var a1 = vec3.create();
		var b1 = vec3.create();
		vec3.scaleAndAdd(a0, a, n0, EDGE_RADIUS);
		vec3.scaleAndAdd(b0, b, n0, EDGE_RADIUS);
		vec3.scaleAndAdd(a1, a, n1, EDGE_RADIUS);
		vec3.scaleAndAdd(b1, b, n1, EDGE_RADIUS);
		marker_triangle(data, [a0, b0, b1], [n0, n0, n1]);
		marker_triangle(data, [a0, b1, a1], [n0, n1, n1]);
	}
}

/*
 * Add a faceted sphere centered at a model-space vertex to the marker buffers.
 */
function add_sphere(data, center) {
	var rings = MARKER_SEGMENTS;
	var slices = MARKER_SEGMENTS;
	for (var i = 0; i < rings; i++) {
		var lat0 = Math.PI * (i / rings - 0.5);
		var lat1 = Math.PI * ((i + 1) / rings - 0.5);
		for (var j = 0; j < slices; j++) {
			var lon0 = 2 * Math.PI * j / slices;
			var lon1 = 2 * Math.PI * (j + 1) / slices;
			var normals = [
				vec3.fromValues(Math.cos(lat0) * Math.cos(lon0),
					Math.sin(lat0), Math.cos(lat0) * Math.sin(lon0)),
				vec3.fromValues(Math.cos(lat1) * Math.cos(lon0),
					Math.sin(lat1), Math.cos(lat1) * Math.sin(lon0)),
				vec3.fromValues(Math.cos(lat1) * Math.cos(lon1),
					Math.sin(lat1), Math.cos(lat1) * Math.sin(lon1)),
				vec3.fromValues(Math.cos(lat0) * Math.cos(lon1),
					Math.sin(lat0), Math.cos(lat0) * Math.sin(lon1))
			];
			var points = normals.map(function(normal) {
				var point = vec3.create();
				vec3.scaleAndAdd(point, center, normal, VERTEX_RADIUS);
				return point;
			});
			marker_triangle(data,
				[points[0], points[1], points[2]],
				[normals[0], normals[1], normals[2]]);
			marker_triangle(data,
				[points[0], points[2], points[3]],
				[normals[0], normals[2], normals[3]]);
		}
	}
}

/*
 * Return a rounded coordinate key for matching coincident model vertices.
 */
function point_key(point) {
	return point.map(function(value) {
		return Math.round(value * 100000);
	}).join(',');
}

function update_controls_panel(shape) {
	var controls = shape.canvas.__showOffControls;
	if (controls) {
		var vertices_visible = shape.gl.my.show_vertices;
		var edges_visible = shape.gl.my.show_edges;
		var faces_visible = shape.gl.my.show_faces;
		update_toggle_button(controls.vertices_button, vertices_visible);
		update_toggle_button(controls.edges_button, edges_visible);
		update_toggle_button(controls.faces_button, faces_visible);
	}
}

/*
 * Keep a toggle's accessible state and raised/pressed appearance in sync.
 */
function update_toggle_button(button, is_pressed) {
	button.setAttribute('aria-pressed', is_pressed ? 'true' : 'false');
	button.style.background = is_pressed ? '#d8eaff' : '#fff';
	button.style.border = is_pressed ?
		'2px inset #426b9a' : '2px outset #b8c3d6';
	button.style.boxShadow = is_pressed ?
		'inset 0 2px 4px rgba(23,32,51,.25)' : '0 1px 2px rgba(0,0,0,.2)';
}

function create_controls_panel(canvas) {
	if (canvas.__showOffControls || !canvas.parentNode) {
		return;
	}
	var doc = canvas.ownerDocument;
	var wrapper = doc.createElement('div');
	wrapper.style.cssText =
		'position:relative;display:inline-block;vertical-align:top;overflow:hidden;max-width:100%;';
	canvas.parentNode.insertBefore(wrapper, canvas);
	wrapper.appendChild(canvas);

	var panel = doc.createElement('aside');
	panel.setAttribute('aria-label', 'Show-off controls');
	panel.style.cssText =
		'position:absolute;z-index:2;top:0;bottom:0;left:0;width:240px;max-width:calc(100% - 8px);' +
		'box-sizing:border-box;padding:56px 12px 12px;background:rgba(20,24,32,.94);color:#fff;' +
		'font:16px sans-serif;transition:transform .2s ease;transform:translateX(calc(-100% + ' +
		PANEL_BUTTON_WIDTH + 'px));';

	var handle = doc.createElement('button');
	handle.type = 'button';
	handle.setAttribute('aria-label', 'Open controls');
	handle.setAttribute('aria-expanded', 'false');
	handle.style.cssText =
		'position:absolute;top:0;right:0;width:' + PANEL_BUTTON_WIDTH + 'px;height:64px;padding:0 0 14px;border:0;' +
		'border-radius:0 0 0 8px;background:#fff;color:#172033;font:24px sans-serif;' +
		'cursor:pointer;touch-action:manipulation;';
	var arrow_icon = doc.createElement('span');
	arrow_icon.textContent = '\u2192';
	handle.addEventListener('click', function() {
		var is_open = handle.getAttribute('aria-expanded') === 'true';
		handle.setAttribute('aria-expanded', is_open ? 'false' : 'true');
		handle.setAttribute('aria-label', is_open ? 'Open controls' : 'Close controls');
		arrow_icon.textContent = is_open ? '\u2192' : '\u2190';
		panel.style.transform = is_open ?
			'translateX(calc(-100% + ' + PANEL_BUTTON_WIDTH + 'px))' : 'translateX(0)';
	});

	var title = doc.createElement('div');
	title.textContent = 'Display';
	title.style.cssText = 'margin-bottom:12px;font-weight:bold;';

	var toggle_style =
		'display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:48px;' +
		'padding:8px;border:2px outset #b8c3d6;border-radius:4px;background:#fff;color:#172033;' +
		'font:inherit;text-align:left;cursor:pointer;touch-action:manipulation;';
	var shortcut_style =
		'min-width:16px;padding:1px 5px;border:1px solid #8995a8;border-radius:3px;' +
		'background:#f1f3f6;color:#172033;font:bold 12px sans-serif;line-height:16px;text-align:center;';

	function make_toggle(label, shortcut, on_click) {
		var button = doc.createElement('button');
		button.type = 'button';
		button.setAttribute('aria-pressed', 'false');
		button.setAttribute('aria-keyshortcuts', shortcut.toUpperCase());
		button.style.cssText = toggle_style;
		var button_label = doc.createElement('span');
		button_label.textContent = label;
		var shortcut_hint = doc.createElement('kbd');
		shortcut_hint.textContent = shortcut;
		shortcut_hint.setAttribute('aria-hidden', 'true');
		shortcut_hint.style.cssText = shortcut_style;
		button.appendChild(button_label);
		button.appendChild(shortcut_hint);
		button.addEventListener('click', on_click);
		return button;
	}

	var vertices_button = make_toggle('Vertices', 'v', function() {
		var shape = canvas.__showOffShape;
		if (shape) {
			shape.set_vertices_visible(!shape.gl.my.show_vertices);
		}
	});
	var edges_button = make_toggle('Edges', 'e', function() {
		var shape = canvas.__showOffShape;
		if (shape) {
			shape.set_edges_visible(!shape.gl.my.show_edges);
		}
	});
	var faces_button = make_toggle('Faces', 'f', function() {
		var shape = canvas.__showOffShape;
		if (shape) {
			shape.set_faces_visible(!shape.gl.my.show_faces);
		}
	});

	panel.appendChild(title);
	panel.appendChild(vertices_button);
	panel.appendChild(edges_button);
	panel.appendChild(faces_button);
	panel.appendChild(handle);
	handle.appendChild(arrow_icon);
	wrapper.appendChild(panel);
	canvas.__showOffControls = {
		wrapper: wrapper,
		panel: panel,
		handle: handle,
		vertices_button: vertices_button,
		edges_button: edges_button,
		faces_button: faces_button
	};
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

function BaseShape(canvas, opt, on_doc) {
	/* Interpret the specified off-data, and draw it on a canvas.
	 *
	 * off_data: string in .off format that specifies the shape
	 * canvas: the canvas node to draw on.
	 * opt: optional parameters in a dictionary. This can be:
	 *      has_concave_faces: boolean that specifies whether the model
	 *                         contains concave faces. Default false.
	 *      bg_col: background colour to use. This is an array specifying
	 *              the red, green, blue channels as values between 0 andn
	 *              1.  If nothing is specified, then black is used.
	 *      The parameter itself isn't optional.
	 * on_doc: optional document object. If undefined then the current
	 *  document is used. If the the canvas is on another document then this
	 *  parameter is needed as well.
	 */
	if (on_doc === undefined) {
		this.doc = document;
	} else {
		this.doc = on_doc;
	}
	if (typeof canvas === 'string') {
		var canvas_name = canvas;
		canvas = this.doc.getElementById(canvas);
	}
	if (canvas === null) {
		console.error("Canvas '" + canvas_name + "' not found! Bailing out")
		return;
	}
	this.canvas = canvas
	this.destroyed = false;
	if (this.canvas.__showOffShape) {
		this.canvas.__showOffShape.destroy();
	}
	this.resize_canvas();
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
	this.gl_init(opt);
	this.gl.my.shader_prog = this.get_shader_prog();
}

BaseShape.prototype.resize_canvas = function() {
	/*
	 * Make the specified canvas size in line with the css Otherwise the
	 * mouse/touch events don't end up at the complete bottom / right. Other
	 * problems are that the 3D shaped is scaled differently in X and Y.
	 */

	// look up the size the canvas is being displayed
	const width = this.canvas.clientWidth;
	const height = this.canvas.clientHeight;

	// If it's resolution does not match change it
	if (this.canvas.width !== width || this.canvas.height !== height) {
		this.canvas.width = width;
		this.canvas.height = height;
	}
}

BaseShape.prototype.paint = function() {
	raf(() => {
		if (!this.destroyed) {
			this.on_paint();
		}
	});
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

BaseShape.prototype.gl_reset_view = function() {
	var gl = this.gl;
	quat.identity(this.q_cur_rot);
	mat4.identity(gl.my.pos_mat);
	mat4.translate(
		gl.my.pos_mat, gl.my.pos_mat, [0.0, 0.0, -gl.my.cam_dist]);
	gl.my.scale_f = gl.my.fit_scale_f;
}

var KC_5 = 53;
var KC_C = 67;
var KC_F = 70;
var KC_E = 69;
var KC_V = 86;

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
		case KC_E:
			this.set_edges_visible(!gl.my.show_edges);
			break;
		case KC_V:
			this.set_vertices_visible(!gl.my.show_vertices);
			break;
		case KC_F:
			this.set_faces_visible(!gl.my.show_faces);
			break;
		}
	} else if (evt.shiftKey && !evt.altKey) {
		/* Only SHIFT */
		switch (evt.keyCode) {
		case KC_5:
			console.log('Undo all zoom');
			gl.my.scale_f = gl.my.fit_scale_f;
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

BaseShape.prototype.input_init = function() {
	this.reset_mouse();
	var this_ = this;
	var handlers = {
		mousedown: function(evt) { this_.on_mouse_down(evt); },
		mouseup: function(evt) { this_.on_mouse_up(evt); },
		mousemove: function(evt) { this_.on_mouse_move(evt); },
		keydown: function(evt) { this_.on_key_down(evt); },
		keyup: function(evt) { this_.on_key_up(evt); },
		touchstart: function(evt) { this_.on_touch_start(evt); },
		touchmove: function(evt) { this_.on_touch_move(evt); },
		touchend: function(evt) { this_.on_touch_end(evt); },
		wheel: function(evt) { this_.on_wheel(evt); }
	};
	this.input_handlers = handlers;
	this.canvas.onmousedown = handlers.mousedown;
	this.canvas.onkeyup = handlers.keyup;
	this.doc.addEventListener('mouseup', handlers.mouseup);
	this.doc.addEventListener('mousemove', handlers.mousemove);
	this.doc.addEventListener('keydown', handlers.keydown);
	this.canvas.addEventListener('touchstart', handlers.touchstart);
	this.canvas.addEventListener('touchmove', handlers.touchmove);
	this.canvas.addEventListener('touchend', handlers.touchend);
	this.canvas.addEventListener('wheel', handlers.wheel);
}

/*
 * Release this shape's input listeners and GPU buffers when its canvas is reused.
 */
BaseShape.prototype.destroy = function() {
	var handlers = this.input_handlers;
	if (handlers) {
		if (this.canvas.onmousedown === handlers.mousedown) {
			this.canvas.onmousedown = null;
		}
		if (this.canvas.onkeyup === handlers.keyup) {
			this.canvas.onkeyup = null;
		}
		this.doc.removeEventListener('mouseup', handlers.mouseup);
		this.doc.removeEventListener('mousemove', handlers.mousemove);
		this.doc.removeEventListener('keydown', handlers.keydown);
		this.canvas.removeEventListener('touchstart', handlers.touchstart);
		this.canvas.removeEventListener('touchmove', handlers.touchmove);
		this.canvas.removeEventListener('touchend', handlers.touchend);
		this.canvas.removeEventListener('wheel', handlers.wheel);
		this.input_handlers = undefined;
	}
	if (!this.destroyed && this.canvas.__showOffShape === this && this.gl) {
		var buffers = [
			this.gl.my.vs, this.gl.my.v_cols, this.gl.my.ns, this.gl.my.fs,
			this.gl.my.vertex_marker_vs, this.gl.my.vertex_marker_ns,
			this.gl.my.vertex_marker_cols, this.gl.my.edge_marker_vs,
			this.gl.my.edge_marker_ns, this.gl.my.edge_marker_cols
		].concat(this.gl.my.ffs || []);
		for (var i = 0; i < buffers.length; i++) {
			if (buffers[i]) {
				this.gl.deleteBuffer(buffers[i]);
			}
		}
		if (this.gl.my.shader_prog) {
			this.gl.deleteProgram(this.gl.my.shader_prog);
		}
	}
	this.destroyed = true;
	this.input_handlers = undefined;
	if (this.canvas.__showOffShape === this) {
		delete this.canvas.__showOffShape;
	}
}

BaseShape.prototype.update_bgcol = function(col) {
	var gl = this.gl;
	gl.clearColor(col[0], col[1], col[2], 1.0);
	this.paint();
}

BaseShape.prototype.set_edges_visible = function(visible) {
	this.gl.my.show_edges = visible;
	if (visible && !this.gl.my.edge_marker_vs) {
		this.update_marker_buffers();
	}
	update_controls_panel(this);
	this.paint();
}

BaseShape.prototype.set_vertices_visible = function(visible) {
	this.gl.my.show_vertices = visible;
	if (visible && !this.gl.my.vertex_marker_vs) {
		this.update_marker_buffers();
	}
	update_controls_panel(this);
	this.paint();
}

BaseShape.prototype.set_faces_visible = function(visible) {
	this.gl.my.show_faces = visible;
	update_controls_panel(this);
	this.paint();
}

BaseShape.prototype.gl_init = function(opt) {
	/*
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
	gl.my.cam_dist = 5.4;
	gl.my.fade_factor = 0.0;
	gl.my.fade_offset = 1.0;
	gl.my.fade_min = 0.0;
	/* Leave a handle-width margin on each side so the closed panel clears the model. */
	gl.my.fit_scale_f = Math.max(
		0.1, (gl.my.viewport_width - 2 * PANEL_BUTTON_WIDTH) / gl.my.viewport_width);
	var query = window.location.search;
	gl.my.show_vertices = /(?:^|[?&])vertices=1(?:&|$)/.test(query);
	gl.my.show_edges = /(?:^|[?&])edges=1(?:&|$)/.test(query);
	var faces_setting = /(?:^|[?&])faces=([01])(?:&|$)/.exec(window.location.search);
	gl.my.show_faces = faces_setting ? faces_setting[1] === '1' : true;
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

	mat4.perspective(gl.my.proj_mat,
		45.0*DEG2RAD, gl.my.viewport_width / gl.my.viewport_height, 0.1, 4*gl.my.cam_dist);

	/* TODO: make these three configurable (after FIXME below is done) */
	var min_factor = 0.01;
	var fading_start = 0.965
	var fading_end = 1.0
	/*
	 * We want to starting fading out the light linearly from a certain
	 * point (after scaling the scene into a unit "cube". Fading out depends
	 * on the distance from the camera (z)
	 * The graphs looks as folows
	 *            |
	 *          1 +----- .
	 *            |       \
	 *            |        \
	 *            |         \
	 *            |          \
	 * min_factor +           .-----
	 *            |
	 *            +------+----+----+-
	 *           O      f_0  f_1  1.0
	 *
	 * z_f is where the fading starts.
	 * f_1 is where the fading ends.
	 * This slope is identified by y = fade_factor * x + fade_offset
	 *
	 * Changing fading_end doesn't seem to have a big impact. It seems it is
	 * hard to increase the fading, even when fading completely from 0.965
	 * to 0.966.  FIXME probably need to debug the inside of the shader
	 */
	gl.my.fade_factor = (min_factor - 1) / (fading_end - fading_start);
	gl.my.fade_offset = 0.1 - gl.my.fade_factor;
	gl.my.fade_min = min_factor
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
	shader_prog.fade_min = gl.getUniformLocation(shader_prog, "fade_min");

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
	var min = 1e-5;
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
			vec3.cross(n, d1, d2);
			ll2 = vec3.sqrLen(n);
			if (ll2 > min) {
				break;
			}
		}
	}
	if ((ll1 <= min) || (ll2 <= min)) {
		console.log(' Warning problems calculating face normal', ll1, ll2);
	}
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
	if (gl.my.show_edges || gl.my.show_vertices ||
		gl.my.vertex_marker_vs || gl.my.edge_marker_vs) {
		this.update_marker_buffers();
	}
}

/*
 * Build and upload separate marker geometry for unique edges and vertices.
 */
BaseShape.prototype.update_marker_buffers = function() {
	var gl = this.gl;
	var vertex_data = {vertices: [], normals: [], colors: []};
	var edge_data = {vertices: [], normals: [], colors: []};
	var vertices = this.base.Vs;
	var points = Object.create(null);
	var edges = [];
	var edge_keys = Object.create(null);

	function add_edge(a, b) {
		var key_a = point_key(a);
		var key_b = point_key(b);
		if (key_a === key_b) {
			return;
		}
		var key = key_a < key_b ? key_a + ':' + key_b : key_b + ':' + key_a;
		if (!edge_keys[key]) {
			edge_keys[key] = true;
			edges.push([a, b]);
		}
	}

	for (var i = 0; i < vertices.length; i++) {
		var key = point_key(vertices[i]);
		if (!points[key]) {
			points[key] = true;
			add_sphere(vertex_data, vertices[i]);
		}
	}
	if (this.base.Es) {
		for (var j = 0; j < this.base.Es.length; j++) {
			add_edge(vertices[this.base.Es[j][0]], vertices[this.base.Es[j][1]]);
		}
	}
	for (var f = 0; f < this.base.Fs.length; f++) {
		var face = this.base.Fs[f];
		for (var k = 0; k < face.length; k++) {
			add_edge(vertices[face[k]], vertices[face[(k + 1) % face.length]]);
		}
	}
	for (var e = 0; e < edges.length; e++) {
		add_cylinder(edge_data, edges[e][0], edges[e][1]);
	}

	function upload_marker(prefix, data) {
		var buffers = [
			[prefix + '_vs', data.vertices, 3],
			[prefix + '_ns', data.normals, 3],
			[prefix + '_cols', data.colors, 4]
		];
		for (var i = 0; i < buffers.length; i++) {
			var buffer = gl.my[buffers[i][0]];
			if (!buffer) {
				buffer = gl.createBuffer();
				gl.my[buffers[i][0]] = buffer;
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buffers[i][1]), gl.STATIC_DRAW);
			buffer.elem_len = buffers[i][2];
		}
		gl.my[prefix + '_count'] = data.vertices.length / 3;
	}
	upload_marker('vertex_marker', vertex_data);
	upload_marker('edge_marker', edge_data);
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

BaseShape.prototype.draw = function() {
	var gl = this.gl;

	this.calc_pos_mat();
	gl.viewport(0, 0, gl.my.viewport_width, gl.my.viewport_height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.uniform1f(gl.my.shader_prog.fade_factor, gl.my.fade_factor);
	gl.uniform1f(gl.my.shader_prog.fade_offset, gl.my.fade_offset);
	gl.uniform1f(gl.my.shader_prog.fade_min, gl.my.fade_min);

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

		if (gl.my.show_faces) {
			/* 4 * 4 offset number of vertices, since:
			 * - 4 bytes per float
			 * - 4 colour channels per vertex
			 */
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
		if ((gl.my.show_vertices && gl.my.vertex_marker_count) ||
			(gl.my.show_edges && gl.my.edge_marker_count)) {
			if (gl.my.use_stencil_buffer) {
				gl.disable(gl.STENCIL_TEST);
			}
			if (gl.my.show_edges && gl.my.edge_marker_count) {
				gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.edge_marker_vs);
				gl.vertexAttribPointer(gl.my.shader_prog.v_pos_attr, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.edge_marker_ns);
				gl.vertexAttribPointer(gl.my.shader_prog.norms_attr, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.edge_marker_cols);
				gl.vertexAttribPointer(gl.my.shader_prog.v_col_attr, 4, gl.FLOAT, false, 0, 0);
				gl.drawArrays(gl.TRIANGLES, 0, gl.my.edge_marker_count);
			}
			if (gl.my.show_vertices && gl.my.vertex_marker_count) {
				gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vertex_marker_vs);
				gl.vertexAttribPointer(gl.my.shader_prog.v_pos_attr, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vertex_marker_ns);
				gl.vertexAttribPointer(gl.my.shader_prog.norms_attr, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, gl.my.vertex_marker_cols);
				gl.vertexAttribPointer(gl.my.shader_prog.v_col_attr, 4, gl.FLOAT, false, 0, 0);
				gl.drawArrays(gl.TRIANGLES, 0, gl.my.vertex_marker_count);
			}
			if (gl.my.use_stencil_buffer) {
				gl.enable(gl.STENCIL_TEST);
			}
		}
	}
}

BaseShape.prototype.first_paint = function() {
	this.canvas.__showOffShape = this;
	this.triangulate();
	this.on_paint();
	this.input_init();
	create_controls_panel(this.canvas);
	update_controls_panel(this);
}

BaseShape.prototype.on_paint = function() {
	this.calc_pos_mat();
	this.draw();
}

BaseShape.prototype.check_vertex_used = function() {
	/* Go through this.base.Vs and this.base.Fs and set
	 * this.base.vertex_used that expresses whether vertices are used.
	 */
	this.base.vertex_used = new Array(this.base.Vs.length).fill(false);
	for (var f_i = 0; f_i < this.base.Fs.length; f_i++) {
		var face = this.base.Fs[f_i];
		for (var v_i = 0; v_i < face.length; v_i++) {
			this.base.vertex_used[face[v_i]] = true;
		}
	}
	if (this.base.Es) {
		for (var e_i = 0; e_i < this.base.Es.length; e_i++) {
			this.base.vertex_used[this.base.Es[e_i][0]] = true;
			this.base.vertex_used[this.base.Es[e_i][1]] = true;
		}
	}
	if (this.base.Ps) {
		for (var p_i = 0; p_i < this.base.Ps.length; p_i++) {
			this.base.vertex_used[this.base.Ps[p_i]] = true;
		}
	}
}

BaseShape.prototype.rescale = function() {
	/*
	 * Normalise the shpae to fit a unit sphere. It seems that this is the
	 * easiest way to get a good light fading and to fit the model into the
	 * cameras FoV.
	 */
	if (!this.base.vertex_used) {
		this.check_vertex_used()
	}

	// Get the maximum radius of this shape
	var max_len_sq = 0;
	for (var i = 0; i < this.base.vertex_used.length; i++) {
		if (this.base.vertex_used[i]) {
			max_len_sq = Math.max(vec3.squaredLength(this.base.Vs[i]), max_len_sq);
		}
	}
	if (max_len_sq === 0) {
		return;
	}

	var factor = 1 / Math.sqrt(max_len_sq);
	for (var i = 0; i < this.base.vertex_used.length; i++) {
		if (this.base.vertex_used[i]) {
			vec3.scale(this.base.Vs[i], this.base.Vs[i], factor);
		}
	}
}

/*
 * Shape is used to show OFF files
 */
function Shape(off_data, canvas, opt, on_doc) {
	/*
	 * Draws a 3D shape on a canvas element with NodeJS
	 * off_data: a string defining the 3D shape in the OFF file format.
	 * canvas: the canvas node to draw on.
	 * opt: a dictionary with options for the 3D shape
	 * on_doc: optional document object. If undefined then the current
	 *  document is used. If the the canvas is on another document then this
	 *  parameter is needed as well.
	 */
	BaseShape.call(this, canvas, opt, on_doc);

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
	// only vertices that are used coontribute to max radius
	var vertex_used;
	var line;
	for (var i = 0; i < lines.length; i++) {
		line = lines[i].replace(/#.*/, "");
		line = line.trim();
		if (!line.match(/\s*(#)/) && line.length != 0) {
			var words = line.match(/\s*(\S+)/g)
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
				this.base.Ps = [];
				/*
				 * array of array to support OrbitShape:
				 * here one transfor, ie. one set of colours
				 */
				this.cols = [new Array(nrOfFs)];
				vertex_used = new Array(nrOfVs);
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
					vertex_used[nrRead] = false;
					nrRead += 1;
					if (nrRead >= this.base.Vs.length) {
						state = this.base.Fs.length ? states.readFs : states.readOk;
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
						var v_no = parseInt(words[j+1]);
						face[j] = v_no;
						vertex_used[v_no] = true;
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
						vertex_used[face[0]] = true;
						vertex_used[face[1]] = true;
					} else if (n == 1) {
						this.base.Ps.push(face[0]);
						vertex_used[face[0]] = true;
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
			case states.readOk:
				var extra_n = parseInt(words[0]);
				if ((extra_n == 1 || extra_n == 2) &&
					(words.length == extra_n + 1 ||
					 words.length == extra_n + 4)) {
					var extra = [];
					for (var e_i = 0; e_i < extra_n; e_i++) {
						extra.push(parseInt(words[e_i + 1]));
					}
					if (extra_n == 2) {
						this.base.Es.push(extra);
						vertex_used[extra[0]] = true;
						vertex_used[extra[1]] = true;
					} else {
						this.base.Ps.push(extra[0]);
						vertex_used[extra[0]] = true;
					}
				}
				break;
			}
			if (error) {
				break;
			}
		}
	}

	this.base.vertex_used = vertex_used;
	this.rescale()

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
function OrbitShape(descriptive, transforms, canvas, opt, on_doc) {
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
	BaseShape.call(this, canvas, opt, on_doc);

	this.base = new Object()
	this.base.Vs = descriptive.Vs;
	this.base.Fs = descriptive.Fs;
	this.base.mat = to_mat4(descriptive.transform);
	this.rescale()

	this.gl.my.obj_mats = new Array(transforms.length);
	this.cols = new Array(transforms.length);
	for (var i = 0; i < transforms.length; i++) {
		this.gl.my.obj_mats[i] =to_mat4(transforms[i])
		this.cols[i] = new Array(this.base.Fs.length);
		var col = transforms[i].col.slice();
		for (var j = 0; j < 3; j++) {
			/* Note below would mean colour 1 1 1 will be interpreted
			 * as white (not as almost black using integer channels
			 */
			var chn = col[j];
			if (chn >= 1) {
				col[j] = chn / 255;
			} else {
				col[j] = chn;
			}
		}
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
function MorphShape(descriptive, canvas, opt, on_doc) {
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
	BaseShape.call(this, canvas, opt, on_doc);

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
	this.rescale()
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
	this.rescale()
	this.triangulate();
	this.paint();
}

global.draw_local_shape = draw_local_shape;
global.draw_shape = draw_shape;
global.draw_url_shape = draw_url_shape;
global.OrbitShape = OrbitShape;
global.MorphShape = MorphShape;

// vim: noexpandtab: sw=8
