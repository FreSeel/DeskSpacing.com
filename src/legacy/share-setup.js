// Classic-script boundary for the retained planners. Keep the modern wire format
// and bounds, but validate against each page's own dictionaries: legacy primitive
// names are carried by the record, rather than restricted to modern catalog IDs.
(function () {
  const limits = {
    characters: 100_000,
    objects: 500,
    coordinate: 1_000_000,
    dimension: 10_000,
  };
  const owns = (dictionary, key) =>
    Object.prototype.hasOwnProperty.call(dictionary, key);

  function invalid(reason) {
    throw new Error(`Invalid setup: ${reason}`);
  }

  function vector(text, label) {
    const parts = text.split(',');
    if (parts[parts.length - 1] === '') parts.pop();
    if (
      parts.length !== 3 ||
      parts.some(
        (part) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(part),
      )
    )
      invalid(label);
    const values = parts.map(Number);
    if (
      values.some(
        (value) =>
          !Number.isFinite(value) || Math.abs(value) > limits.coordinate,
      )
    )
      invalid(label);
    return values;
  }

  function decode(input, models, textures, desks) {
    if (typeof input !== 'string' || input.length > limits.characters)
      invalid('length');
    const text = input.trim();
    if (text[0] !== '[' || text[text.length - 1] !== ']')
      invalid('missing brackets');
    const body = text.slice(1, -1).trim();
    if (!body) return [];
    const tokens = body.split(/\s+/);
    if (tokens.length > limits.objects) invalid('too many objects');
    return tokens.map((token) => {
      const marker = token[0] === '^' || token[0] === '*' ? token[0] : '';
      if (marker) {
        if (token[token.length - 1] !== marker) invalid('unclosed primitive');
        token = token.slice(1, -1);
      }
      const fields = token.split('|');
      if (fields.pop() !== '' || fields.length !== (marker ? 6 : 4))
        invalid('fields');
      const [type, product, position, rotation, dimensions, texture] = fields;
      if (!/^[A-Za-z]+$/.test(type)) invalid('object type');
      if (!product || /[[\]*^]/.test(product)) invalid('object name');
      if (Boolean(marker) !== type.includes('Primitive'))
        invalid('primitive marker');
      const record = {
        type,
        product,
        position: vector(position, 'position'),
        rotation: vector(rotation, 'rotation'),
      };
      if (marker) {
        if (type.includes('Box') === type.includes('Sphere')) invalid('shape');
        record.dimensions = vector(dimensions, 'dimensions');
        const size = type.includes('Sphere')
          ? record.dimensions.slice(0, 1)
          : record.dimensions;
        if (size.some((value) => value <= 0 || value > limits.dimension))
          invalid('dimensions');
        if (
          type.includes('Sphere') &&
          (record.dimensions[1] !== -1 || record.dimensions[2] !== -1)
        )
          invalid('sphere dimensions');
        if (texture !== 'null' && !owns(textures, texture)) invalid('texture');
        record.texture = texture;
      } else if (!owns(models, product) || !models[product][4]) {
        invalid('product');
      }
      if (type.includes('Desk') && !owns(desks, product)) invalid('desk');
      return record;
    });
  }

  window.DeskSpacingLegacySetup = {
    decode,
    read(location) {
      // URLSearchParams tolerates broken percent escapes, handles '+' spaces and
      // duplicate keys, and cannot be shadowed by a hasOwnProperty query key.
      return new URL(location).searchParams.get('customSetup');
    },
  };
})();
