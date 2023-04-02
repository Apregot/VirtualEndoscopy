<?php

namespace VirtualEndoscopy\Context;

abstract class Context
{
	abstract public function runScript(): bool;
	abstract public function getType(): string;
	abstract protected function getScriptsDirectory(): string;
	abstract protected function getScriptExtension(): string;
}
