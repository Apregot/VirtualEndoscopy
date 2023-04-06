<?php

namespace VirtualEndoscopy;
final class Config
{
	const LINUX = 'Lin';
	const WINDOWS = 'Win';

	const DEFAULT_SCRIPT_DIRECTORY = 'scripts';
	const SUPPORTED_SYSTEMS = [
		self::WINDOWS,
		self::LINUX,
	];
	const SCRIPTS = [
		'findFreePort' => 'find_free_port',
		'isBuilt' => 'is_built',
	];
}