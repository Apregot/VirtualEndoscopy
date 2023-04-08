<?php

namespace VirtualEndoscopy\Script;

final class RunContainerScript extends BaseScript
{
	protected function validateData(array $data): bool
	{
		return
			!empty($data['dockerExecutable'])
			&& !empty($data['outerPort'])
			&& !empty($data['imageName'])
		;
	}

	protected function prepareData(array $data): array
	{
		return [
			'dockerExecutable' => '"' . $data['dockerExecutable'] . '"',
			'outerPort' => $data['outerPort'],
			'imageName' => '"' . $data['imageName'] . '"',
		];
	}
}