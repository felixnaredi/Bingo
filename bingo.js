// bingo.js
//
// Author: Felix Naredi
// Date: 2018-06-16 23:14:54 +0200

function State () {
	return {
		checked: false,
		bingo: 0,
		text: "",
	};
}

function MouseHoldEventHandler(element, lambda, interval = 500) {
	let didClick = false;
	let timer = null;
	element.onmousedown = (event) => {
		lambda.down(event);
		didClick = true;
		timer = setTimeout(() => {
			didClick = false;
			if(lambda.hold) {
				lambda.hold(event);
			}
		}, interval);
	};
	element.onmouseup = (event) => {
		if(didClick) {
			clearTimeout(timer);
			if(lambda.click) {
				lambda.click(event);
			}
		}
	};
}

function Board(arg = {}) {
	let self = {
		creationDate: (() => {
			return arg.creationDate == null ?
				(new Date()).getTime() :
				arg.creationDate;
		})(),
		label: (() => {
			return arg.label == null ?
				"New Board" :
				arg.label;
		})(),
		size: (() => {
			return arg.size == null ?
				5 :
				arg.size;
		})(),
		state: (() => {
			if(arg.state) {
				return arg.state;
			}
			let count = arg.size == null ?
				25 :
				arg.size * arg.size;
			let state = [];
			for(let i = 0; i < count; i++) {
				state.push(State());
			}
			return state;
		})(),
		hash: (() => {
			return arg.creationDate == null ?
				(new Date()).getTime() :
				arg.creationDate;
		})(),
		channels: {
			labelDidChange: {
				subscribers: [],
				subscribe: (lambda) => {
					self.channels.labelDidChange.subscribers.push(lambda);
				},
				broadcast: (label) => {
					self.channels.labelDidChange.subscribers
						.forEach((lambda) => lambda(label));
				},
			},
		},
		setLabel: (value) => {
			if(board.label == value) {
				return;
			}
			board.label = value;
			board.channels.labelDidChange.broadcast(value);
		},
		connectLabelTextarea: (textarea) => {
			textarea.value = self.label;
			textarea.onkeypress = () => {
				self.setLabel(textarea.value);
			};
			textarea.onkeyup = () => {
				self.setLabel(textarea.value);
			};
			textarea.onblur = () => { self.store() }
			self.channels.labelDidChange.subscribe((label) => {
				textarea.value = label;
			});
		},
		encodeToJSON: () => {
			return JSON.stringify({
				hash: self.hash,
				label: self.label,
				size: self.size,
				state: self.state,
			});
		},
		store: () => {
			localStorage.setItem(self.hash, self.encodeToJSON());
			localStorage.setItem('boardKeys', JSON.stringify([self.hash]));
		},
	};
	return self;
}

function makeBoardTable(board, lambda) {
	let clickLock = [false, false];
	let table = document.createElement('table');
	let caption = document.createElement('caption');

	let captionTextarea = document.createElement('textarea');
	board.connectLabelTextarea(captionTextarea);
	caption.appendChild(captionTextarea);
	table.appendChild(caption);

	let model = {
		board: board,
		captionTextarea: captionTextarea,
		label: {
			get: () => { captionTextarea.value },
			set: (value) => { captionTextarea.value = value },
		},
		cells: [],
		groups: null,
		bingoGroups: () => {
			return model.groups.filter((group) => {
				return group.every((cell) => cell.data.checked);
			});
		},
		remove: () => {
			console.log("remove - function is not implemented");
		},
	};

	let groups = {
		rows: [],
		columns: [],
		diagonals: [[], []],
	};
	let i = 0;
	for(let y = 0; y < board.size; y++) {
		let row = table.insertRow(y);
		groups.rows[y] = [];
		for(let x = 0; x < board.size; x++) {
			let cell = row.insertCell(x);
			cell.data = board.state[i];

			groups.rows[y].push(cell);
			if(groups.columns[x] == null) {
				groups.columns[x] = [];
			}
			groups.columns[x].push(cell);
			if(x == y) {
				groups.diagonals[0].push(cell);
			}
			if(x + y == board.size - 1) {
				groups.diagonals[1].push(cell);
			}

			let textarea = document.createElement('textarea');
			textarea.value = cell.data.text;
			textarea.readOnly = true;
			textarea.onblur = () => {
				clickLock[0] = false;
				textarea.readOnly = true;
				if(lambda.cellDidExitEditMode) {
					cell.data.text = textarea.value;
					lambda.cellDidExitEditMode(cell);
				}
			};
			cell.textarea = textarea;
			cell.appendChild(textarea);

			MouseHoldEventHandler(
				cell,
				{
					down: () => {
						if(clickLock[0]) {
							clickLock[1] = true;
						}
					},
					click: () => {
						if(clickLock[1]) {
							clickLock[1] = false;
							return;
						}
						if(lambda.cellWillToggle) {
							lambda.cellWillToggle(cell);
						}
						if(cell.data.checked) {
							model.bingoGroups()
								.filter((group) => group.indexOf(cell) > -1)
								.forEach((group) => {
									group.forEach((cell) => {
										cell.data.bingo -= 1;
									});
								});
							cell.data.bingo = 0;
						}
						cell.data.checked = !cell.data.checked;
						if(cell.data.checked) {
							model.bingoGroups()
								.filter((group) => group.indexOf(cell) > -1)
								.forEach((group) => {
									group.forEach((cell) => {
										cell.data.bingo += 1;
									});
								});
						}
						if(lambda.cellDidToggle) {
							lambda.cellDidToggle(cell);
						}
					},
					hold: () => {
						clickLock[0] = true;
						textarea.readOnly = false;
						textarea.focus();
						if(lambda.cellDidEnterEditMode) {
							lambda.cellDidEnterEditMode(cell);
						}
					},
				});

			model.cells.push(cell);
			if(lambda.tableDidAppendCell) {
				lambda.tableDidAppendCell(cell);
			}

			i++;
		}
	}

	model.groups = groups.rows
		.concat(groups.columns)
		.concat(groups.diagonals);
	table.model = model;

	if(lambda.didCreateTable) {
		lambda.didCreateTable(table);
	}
	return table;
}
