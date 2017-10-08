# mei-tools-atom

[MEI](http://music-encoding.org/) is an open-source XML-based standard for the semantic encoding of music documents. This package, for use with the open-source [Atom text editor](https://atom.io/), aims to provide MEI developers with on-the-fly

- validation
- autocompletion
- rendering into notation with _[Verovio](http://www.verovio.org/)_

This package is currently under development.

## Current Features
- as-you-type notation rendering with _[Verovio](http://www.verovio.org/)_
- current element in MEI (based on cursor position) is highlighted in notation
    - this feature works by matching `xml:id`s to class names of `g` elements of the `svg` rendered by _[Verovio](http://www.verovio.org/)_, so if you have no `xml:id`s on your elements you will have no highlighting in your notation
- click on a note or other graphic notation element to take the cursor to the associated place in the MEI code

## Planned Features
- allow resizing of rendered notation (zoom in/out)
- allow choice of highlighting color

## Installation

TODO: How to install

## Dependencies

This package relies on two other packages which will be automatically installed when this package is installed:
- [atom-language-mei](https://github.com/nCoda/atom-language-mei)
- [linter-autocomplete-jing](https://github.com/aerhard/linter-autocomplete-jing)
    - Requires Java Runtime Environment (JRE) v1.6 or above.  Follow the link to the package repository for details.
