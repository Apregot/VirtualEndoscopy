<?php

namespace VirtualEndoscopy\Build;

use VirtualEndoscopy\App;

final class BuildManager
{
	private const BASE_LAYERS = [
		Dictionary::BASE_LAYER_0 => 'Dockerfile0',
		Dictionary::BASE_LAYER_1 => 'Dockerfile1',
		Dictionary::BASE_LAYER_2 => 'Dockerfile2',
		Dictionary::BASE_LAYER_3 => 'Dockerfile3',
	];

	public function isBaseLayersBuilt(): bool
	{
		$result = true;
		foreach (self::BASE_LAYERS as $layer => $a)
		{
			if (!$this->isLayerBuilt($layer))
			{
				$result = false;
				break;
			}
		}

		return $result;
	}

	public function isLayerBuilt(string $layer): bool
	{
		echo App::getInstance()->getContext()->runCommand('cmd /c docker images 2&>1');
		return true;
	}

}

