# Error List
Some of these may need to go in the core IR as well. 

## Syntax level:
1. Every cdot MUST have a \bigwedge. If it doesn't, error out (see `example5_test_code.txt`)
2. Recognize user-defined functions and user-defined datatypes and flag the user with a warning.
   - Remind them that they MUST have an entry in the user-defined registry. 

## Validation IR level (for Toluwa):
1. If a user-defined entry does not exist in the registry ERRORRRRRRR!

## Runtime level:
1. If a reduction occurs, but there is no reduction op, spit out a warning that we are using the default Reduction operator. 
