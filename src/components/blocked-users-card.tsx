import { Alert, View } from 'react-native';
import { Button, Card, List, useTheme } from 'react-native-paper';

import { UserAvatar } from '@/components/user-avatar';
import { useLoader } from '@/hooks/use-loader';
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/lib/api';
import { surfaceCard } from '@/theme';

/** People you've blocked from chat, with unblock. Hidden when the list is empty. */
export function BlockedUsersCard({ userId }: { userId: string }) {
  const theme = useTheme();
  const { data, reload } = useLoader(() => getBlockedUsers(userId), `blocked:${userId}`);

  if (!data?.length) return null;

  function unblock(user: BlockedUser) {
    unblockUser(userId, user.id)
      .then(reload)
      .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : String(e)));
  }

  return (
    <Card mode="contained" style={surfaceCard(theme)}>
      <List.Accordion
        title={`Blocked users · ${data.length}`}
        description="Their chat messages are hidden from you"
        left={(props) => <List.Icon {...props} icon="account-cancel-outline" />}
        style={{ backgroundColor: 'transparent' }}>
        {data.map((user) => (
          <List.Item
            key={user.id}
            title={user.display_name}
            left={() => (
              <View style={{ justifyContent: 'center', marginLeft: 16 }}>
                <UserAvatar name={user.display_name} color={user.avatar_color} icon={user.avatar_icon} size={32} />
              </View>
            )}
            right={() => (
              <Button compact onPress={() => unblock(user)}>
                Unblock
              </Button>
            )}
          />
        ))}
      </List.Accordion>
    </Card>
  );
}
