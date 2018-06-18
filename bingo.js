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

function MouseHoldEventHandler(element, agent, interval = 500) {
	let didClick = false;
	let timer = null;
	element.onmousedown = (event) => {
		agent.down(event);
		didClick = true;
		timer = setTimeout(() => {
			didClick = false;
			if(agent.hold) {
				agent.hold(event);
			}
		}, interval);
	};
	element.onmouseup = (event) => {
		if(didClick) {
			clearTimeout(timer);
			if(agent.click) {
				agent.click(event);
			}
		}
	};
}

function Board(agent = {}) {
	let self = {
		creationDate: agent.creationDate == null ?
			(new Date()).getTime() :
			agent.creationDate,
		label: agent.label == null ?
			"New Board" :
			agent.label,
		size: agent.size == null ?
			5 :
			agent.size,
		state: (() => {
			if(agent.state) {
				return agent.state;
			}
			let count = agent.size == null ?
				25 :
				agent.size * agent.size;
			let state = [];
			for(let i = 0; i < count; i++) {
				state.push(State());
			}
			return state;
		})(),
		hash: agent.hash == null ?
			(new Date()).getTime() :
			agent.hash,
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
			if(self.label == value) {
				return;
			}
			self.label = value;
			self.channels.labelDidChange.broadcast(value);
		},
		connectLabelTextfield: (textarea) => {
			textarea.value = self.label;
			textarea.onkeypress = () => {
				self.setLabel(textarea.value);
			};
			textarea.onkeyup = () => {
				self.setLabel(textarea.value);
			};
			textarea.onblur = () => { self.writeToLocalStorage() }
			self.channels.labelDidChange.subscribe((label) => {
				textarea.value = label;
			});
		},
		encode: {
			json: () => {
				return JSON.stringify({
					hash: self.hash,
					label: self.label,
					size: self.size,
					state: self.state,
					meta: {
						creationDate: self.creationDate,
					},
				});
			},
		},
		writeToLocalStorage: (encoding = self.encode.json()) => {
			if(agent.writeToLocalStorage == null || encoding == null) {
				return;
			}
			agent.writeToLocalStorage(self, encoding);
		},
	};
	return self;
}

function BoardTable(board, agent) {
	let clickLock = {
		0: false,
		1: false,
	};
	let table = document.createElement('table');
	let caption = document.createElement('caption');

	let captionInput = document.createElement('input');
	board.connectLabelTextfield(captionInput);
	caption.appendChild(captionInput);
	table.appendChild(caption);

	let model = {
		board: board,
		captionInput: captionInput,
		cells: [],
		groups: null,
		bingoGroups: () => {
			return model.groups.filter((group) => {
				return group.every((cell) => cell.data.checked);
			});
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
				if(agent.cellDidExitEditMode) {
					cell.data.text = textarea.value;
					agent.cellDidExitEditMode(cell);
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
						if(agent.cellWillToggle) {
							agent.cellWillToggle(cell);
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
						if(agent.cellDidToggle) {
							agent.cellDidToggle(cell);
						}
					},
					hold: () => {
						clickLock[0] = true;
						textarea.readOnly = false;
						textarea.focus();
						if(agent.cellDidEnterEditMode) {
							agent.cellDidEnterEditMode(cell);
						}
					},
				}, 250);

			model.cells.push(cell);
			if(agent.tableDidAppendCell) {
				agent.tableDidAppendCell(cell);
			}

			i++;
		}
	}

	model.groups = groups.rows
		.concat(groups.columns)
		.concat(groups.diagonals);
	table.model = model;

	if(agent.didCreateTable) {
		agent.didCreateTable(table);
	}
	return table;
}

function TableMenu(agent) {
	let self = Object.assign(
		document.createElement('table'),
		{
			selectedMenuItem: null,
			selectMenuItem: (item) => {
				self.selectedMenuItem = item;
				if(agent.didSelectMenuItem) {
					agent.didSelectMenuItem(item);
				}
			},
			insertMenuItem: (model) => {
				let item = self.insertRow();
				item.model = model;
				item.onclick = () => {
					if(agent.didClickItem) {
						agent.didClickItem(item);
					}
				};
				if(agent.insertMenuItem == null) {
					agent.didInsertMenuItem(item, model);;
				}
				return item;
			},
		});
	return self;
}

function BoardMenu(agent) {
	let clickLock = {
		0: false, // Locks select during edit.
		1: false, // Locks click when exiting edit mode or on removed menu item.
	};
	let editedMenuItem = null;

	let self = TableMenu({
		didSelectMenuItem: (item) => {
			if(agent.didSelectMenuItem) {				
				agent.didSelectMenuItem(item);
			}
		},
		didClickItem: (item) => {
			if(clickLock[0]) {
				return;
			}
			if(clickLock[1]) {
				clickLock[1] = false;
				return;
			}
			self.selectMenuItem(item);
			if(agent.didClickItem) {
				agent.didClickItem(item);
			}
		},
		didInsertMenuItem: (item, model) => {
			item.editMode = false;

			let input = document.createElement('input');
			model.connectLabelTextfield(input);
			item.insertCell().appendChild(input);

			let removeButton = document.createElement('button');
			removeButton.className = agent.classNames.removeButton;
			removeButton.onclick = () => {
				if(agent.willRemoveMenuItem) {
					agent.willRemoveMenuItem(item);
				}
				clickLock = {0: false, 1: true};
				if(self.selectedMenuItem != item) {
					item.remove();
					return;
				}
				let items = Object.values(self.rows);
				let index = items.indexOf(item);
				if(index == 0) {
					self.selectMenuItem(items[1]);
				} else {
					self.selectMenuItem(items[index - 1]);
				}
				item.remove();
			}
			removeButton.appendChild(document.createTextNode("Remove"));

			let setMenuItemProperties = (item) => {
				if(item.editMode) {
					item.removeButtonCell = item.insertCell(0);
					item.removeButtonCell.appendChild(removeButton);
					input.readOnly = false;
					item.className = agent.classNames.editModeOn;
				} else {
					if(item.removeButtonCell) {
						item.removeButtonCell.remove();
					}
					input.readOnly = true;
					item.className = agent.classNames.editModeOff;
				}
			};

			let editButton = document.createElement('button');

			editButton.onclick = () => {
				if(item.editMode) {
					item.editMode = false;
					clickLock = {0: false, 1: true};
					setMenuItemProperties(item);
					return;
				}
				if(clickLock[0]) {
					console.log(editedMenuItem);
					editedMenuItem.editMode = false;
					setMenuItemProperties(editedMenuItem);
				}
				item.editMode = true;
				editedMenuItem = item;
				clickLock = {0: true, 1: false};
				setMenuItemProperties(item);
			}
			editButton.appendChild(document.createTextNode("Edit"));
			item.insertCell().appendChild(editButton);

			setMenuItemProperties(item);
		},
	});
	return self;
}
