<?php

namespace VirtualEndoscopy\Context;

use VirtualEndoscopy\Config;

final class Windows extends Context
{

	public function getType(): string
	{
		return 'Windows';
	}

	public function getScriptRunner(): string
	{
		return 'cmd /c';
	}

	protected function getScriptsDirectory(): string
	{
		return Config::DEFAULT_SCRIPT_DIRECTORY . DIRECTORY_SEPARATOR . 'windows' . DIRECTORY_SEPARATOR;
	}

	protected function getScriptExtension(): string
	{
		return '.bat';
	}
}