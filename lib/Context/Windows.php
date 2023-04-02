<?php

namespace VirtualEndoscopy\Context;

use VirtualEndoscopy\Config;

final class Windows extends Context
{

	public function runScript(): bool
	{
		return true;
	}

	public function getType(): string
	{
		return 'Windows';
	}

	protected function getScriptsDirectory(): string
	{
		return Config::DEFAULT_SCRIPT_DIRECTORY . DIRECTORY_SEPARATOR . 'windows' . DIRECTORY_SEPARATOR;
	}

	protected function getScriptExtension(): string
	{
		return 'bat';
	}
}