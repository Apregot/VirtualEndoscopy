<?php

namespace VirtualEndoscopy\Context;

use VirtualEndoscopy\Config;

final class Linux extends Context
{

	public function getType(): string
	{
		return 'Linux';
	}

	protected function getScriptsDirectory(): string
	{
		return Config::DEFAULT_SCRIPT_DIRECTORY . DIRECTORY_SEPARATOR . 'linux' . DIRECTORY_SEPARATOR;
	}

	protected function getScriptExtension(): string
	{
		return '.sh';
	}
}
