import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/button';
import { DropdownMenu, MenuGroup, MenuItem } from '@/components/dropdown-menu';
import { TrickIcon } from '@/components/trick-icon';
import { learnedTricks, training, type TrickId } from '@/lib/world';

/**
 * The Tricks button under Pet and Play: a menu of the tricks it knows, so you can ask for one and
 * watch it right there in the scene. The one it's learning and the way to the trick shop sit at the
 * bottom.
 */
export function TrickMenu({
  fed,
  style,
  onShowOff,
  onShop,
}: {
  /** Treats it has eaten. */
  fed: number;
  /** Where it sits in its row (it fills its width). */
  style?: StyleProp<ViewStyle>;
  onShowOff: (trick: TrickId) => void;
  onShop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const learned = learnedTricks(fed);
  const learning = training(fed);

  function choose(then: () => void) {
    setOpen(false);
    then();
  }

  return (
    <View style={style}>
      <DropdownMenu
        open={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            mode="contained-tonal"
            icon="star-four-points"
            trailingIcon={open ? 'chevron-up' : 'chevron-down'}
            compact
            onPress={() => setOpen(!open)}
            accessibilityLabel={`Tricks, ${learned.length} known`}>
            {learned.length ? `Tricks · ${learned.length}` : 'Tricks'}
          </Button>
        }>
        <MenuGroup>
          {learned.map((trick) => (
            <MenuItem
              key={trick.id}
              icon={({ size, color }: { size: number; color: string }) => (
                <TrickIcon trick={trick.id} size={size + 4} color={color} />
              )}
              label={trick.name}
              onPress={() => choose(() => onShowOff(trick.id))}
            />
          ))}
          {learned.length ? null : (
            <MenuItem icon="star-four-points-outline" label="No tricks yet" supporting="Every treat is practice" disabled />
          )}
        </MenuGroup>
        <MenuGroup>
          <MenuItem
            icon="storefront-outline"
            label="Trick shop"
            supporting={
              learning
                ? `Learning ${learning.trick.name} · ${learning.given}/${learning.trick.treats} treats`
                : 'Every trick learned'
            }
            onPress={() => choose(onShop)}
          />
        </MenuGroup>
      </DropdownMenu>
    </View>
  );
}
