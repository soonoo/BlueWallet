import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { BitcoinUnit } from '../models/bitcoinUnits';
import * as NavigationService from '../NavigationService';
import loc, { formatBalanceWithoutSuffix, transactionTimeToReadable } from '../loc';
import Lnurl from '../class/lnurl';
import { BlueStorageContext } from '../blue_modules/storage-context';
import ToolTipMenu from './TooltipMenu';
import TransactionExpiredIcon from '../components/icons/TransactionExpiredIcon';
import TransactionIncomingIcon from '../components/icons/TransactionIncomingIcon';
import TransactionOffchainIcon from '../components/icons/TransactionOffchainIcon';
import TransactionOffchainIncomingIcon from '../components/icons/TransactionOffchainIncomingIcon';
import TransactionOnchainIcon from '../components/icons/TransactionOnchainIcon';
import TransactionOutgoingIcon from '../components/icons/TransactionOutgoingIcon';
import TransactionPendingIcon from '../components/icons/TransactionPendingIcon';
import { useTheme } from './themes';
import ListItem from './ListItem';
import { useSettings } from './Context/SettingsContext';
import { LightningTransaction, Transaction } from '../class/wallets/types';

interface TransactionListItemProps {
  itemPriceUnit: BitcoinUnit;
  walletID: string;
  item: Transaction & LightningTransaction; // using type intersection to have less issues with ts
}

export const TransactionListItem: React.FC<TransactionListItemProps> = React.memo(({ item, itemPriceUnit = BitcoinUnit.BTC, walletID }) => {
  const [subtitleNumberOfLines, setSubtitleNumberOfLines] = useState(1);
  const { colors } = useTheme();
  const { navigate } = useNavigation();
  const menuRef = useRef();
  const { txMetadata, wallets } = useContext(BlueStorageContext);
  const { preferredFiatCurrency, language } = useSettings();
  const containerStyle = useMemo(
    () => ({
      backgroundColor: 'transparent',
      borderBottomColor: colors.lightBorder,
      paddingTop: 16,
      paddingBottom: 16,
      paddingRight: 0,
    }),
    [colors.lightBorder],
  );

  const shortenContactName = (addr: string): string => {
    return addr.substr(0, 5) + '...' + addr.substr(addr.length - 4, 4);
  };

  const title = useMemo(() => {
    if (item.confirmations === 0) {
      return loc.transactions.pending;
    } else {
      return transactionTimeToReadable(item.received!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.confirmations, item.received, language]);

  const txMemo = (item.counterparty ? `[${shortenContactName(item.counterparty)}] ` : '') + (txMetadata[item.hash]?.memo ?? '');
  const subtitle = useMemo(() => {
    let sub = Number(item.confirmations) < 7 ? loc.formatString(loc.transactions.list_conf, { number: item.confirmations }) : '';
    if (sub !== '') sub += ' ';
    sub += txMemo;
    if (item.memo) sub += item.memo;
    return sub || null;
  }, [txMemo, item.confirmations, item.memo]);

  const rowTitle = useMemo(() => {
    if (item.type === 'user_invoice' || item.type === 'payment_request') {
      if (isNaN(Number(item.value))) {
        item.value = 0;
      }
      const currentDate = new Date();
      const now = (currentDate.getTime() / 1000) | 0; // eslint-disable-line no-bitwise
      const invoiceExpiration = item.timestamp! + item.expire_time!;

      if (invoiceExpiration > now) {
        return formatBalanceWithoutSuffix(item.value && item.value, itemPriceUnit, true).toString();
      } else if (invoiceExpiration < now) {
        if (item.ispaid) {
          return formatBalanceWithoutSuffix(item.value && item.value, itemPriceUnit, true).toString();
        } else {
          return loc.lnd.expired;
        }
      }
    } else {
      return formatBalanceWithoutSuffix(item.value && item.value, itemPriceUnit, true).toString();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, itemPriceUnit, preferredFiatCurrency]);

  const rowTitleStyle = useMemo(() => {
    let color = colors.successColor;

    if (item.type === 'user_invoice' || item.type === 'payment_request') {
      const currentDate = new Date();
      const now = (currentDate.getTime() / 1000) | 0; // eslint-disable-line no-bitwise
      const invoiceExpiration = item.timestamp! + item.expire_time!;

      if (invoiceExpiration > now) {
        color = colors.successColor;
      } else if (invoiceExpiration < now) {
        if (item.ispaid) {
          color = colors.successColor;
        } else {
          color = '#9AA0AA';
        }
      }
    } else if (item.value! / 100000000 < 0) {
      color = colors.foregroundColor;
    }

    return {
      color,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'right',
      width: 96,
    };
  }, [item, colors.foregroundColor, colors.successColor]);

  const avatar = useMemo(() => {
    // is it lightning refill tx?
    if (item.category === 'receive' && item.confirmations! < 3) {
      return (
        <View style={styles.iconWidth}>
          <TransactionPendingIcon />
        </View>
      );
    }

    if (item.type && item.type === 'bitcoind_tx') {
      return (
        <View style={styles.iconWidth}>
          <TransactionOnchainIcon />
        </View>
      );
    }
    if (item.type === 'paid_invoice') {
      // is it lightning offchain payment?
      return (
        <View style={styles.iconWidth}>
          <TransactionOffchainIcon />
        </View>
      );
    }

    if (item.type === 'user_invoice' || item.type === 'payment_request') {
      if (!item.ispaid) {
        const currentDate = new Date();
        const now = (currentDate.getTime() / 1000) | 0; // eslint-disable-line no-bitwise
        const invoiceExpiration = item.timestamp! + item.expire_time!;
        if (invoiceExpiration < now) {
          return (
            <View style={styles.iconWidth}>
              <TransactionExpiredIcon />
            </View>
          );
        }
      } else {
        return (
          <View style={styles.iconWidth}>
            <TransactionOffchainIncomingIcon />
          </View>
        );
      }
    }

    if (!item.confirmations) {
      return (
        <View style={styles.iconWidth}>
          <TransactionPendingIcon />
        </View>
      );
    } else if (item.value! < 0) {
      return (
        <View style={styles.iconWidth}>
          <TransactionOutgoingIcon />
        </View>
      );
    } else {
      return (
        <View style={styles.iconWidth}>
          <TransactionIncomingIcon />
        </View>
      );
    }
  }, [item]);

  useEffect(() => {
    setSubtitleNumberOfLines(1);
  }, [subtitle]);

  const onPress = useCallback(async () => {
    // @ts-ignore: idk how to fix
    menuRef?.current?.dismissMenu?.();
    if (item.hash) {
      // @ts-ignore: idk how to fix
      navigate('TransactionStatus', { hash: item.hash, walletID });
    } else if (item.type === 'user_invoice' || item.type === 'payment_request' || item.type === 'paid_invoice') {
      const lightningWallet = wallets.filter(wallet => wallet?.getID() === item.walletID);
      if (lightningWallet.length === 1) {
        try {
          // is it a successful lnurl-pay?
          const LN = new Lnurl(false, AsyncStorage);
          let paymentHash = item.payment_hash!;
          if (typeof paymentHash === 'object') {
            paymentHash = Buffer.from(paymentHash.data).toString('hex');
          }
          const loaded = await LN.loadSuccessfulPayment(paymentHash);
          if (loaded) {
            NavigationService.navigate('ScanLndInvoiceRoot', {
              // @ts-ignore: idk how to fix
              screen: 'LnurlPaySuccess',
              params: {
                paymentHash,
                justPaid: false,
                fromWalletID: lightningWallet[0].getID(),
              },
            });
            return;
          }
        } catch (e) {
          console.log(e);
        }

        // @ts-ignore: idk how to fix
        navigate('LNDViewInvoice', {
          invoice: item,
          walletID: lightningWallet[0].getID(),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, wallets]);

  const handleOnExpandNote = useCallback(() => {
    setSubtitleNumberOfLines(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitle]);

  const subtitleProps = useMemo(() => ({ numberOfLines: subtitleNumberOfLines }), [subtitleNumberOfLines]);

  const handleOnCopyAmountTap = useCallback(() => Clipboard.setString(rowTitle.replace(/[\s\\-]/g, '')), [rowTitle]);
  const handleOnCopyTransactionID = useCallback(() => Clipboard.setString(item.hash), [item.hash]);
  const handleOnCopyNote = useCallback(() => Clipboard.setString(subtitle), [subtitle]);
  const handleOnViewOnBlockExplorer = useCallback(() => {
    const url = `https://mempool.space/tx/${item.hash}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      }
    });
  }, [item.hash]);
  const handleCopyOpenInBlockExplorerPress = useCallback(() => {
    Clipboard.setString(`https://mempool.space/tx/${item.hash}`);
  }, [item.hash]);

  const onToolTipPress = useCallback(
    (id: any) => {
      if (id === actionKeys.CopyAmount) {
        handleOnCopyAmountTap();
      } else if (id === actionKeys.CopyNote) {
        handleOnCopyNote();
      } else if (id === actionKeys.OpenInBlockExplorer) {
        handleOnViewOnBlockExplorer();
      } else if (id === actionKeys.ExpandNote) {
        handleOnExpandNote();
      } else if (id === actionKeys.CopyBlockExplorerLink) {
        handleCopyOpenInBlockExplorerPress();
      } else if (id === actionKeys.CopyTXID) {
        handleOnCopyTransactionID();
      }
    },
    [
      handleCopyOpenInBlockExplorerPress,
      handleOnCopyAmountTap,
      handleOnCopyNote,
      handleOnCopyTransactionID,
      handleOnExpandNote,
      handleOnViewOnBlockExplorer,
    ],
  );

  const toolTipActions = useMemo(() => {
    const actions = [];
    if (rowTitle !== loc.lnd.expired) {
      actions.push({
        id: actionKeys.CopyAmount,
        text: loc.transactions.details_copy_amount,
        icon: actionIcons.Clipboard,
      });
    }

    if (subtitle) {
      actions.push({
        id: actionKeys.CopyNote,
        text: loc.transactions.details_copy_note,
        icon: actionIcons.Clipboard,
      });
    }
    if (item.hash) {
      actions.push(
        {
          id: actionKeys.CopyTXID,
          text: loc.transactions.details_copy_txid,
          icon: actionIcons.Clipboard,
        },
        {
          id: actionKeys.CopyBlockExplorerLink,
          text: loc.transactions.details_copy_block_explorer_link,
          icon: actionIcons.Clipboard,
        },
        [
          {
            id: actionKeys.OpenInBlockExplorer,
            text: loc.transactions.details_show_in_block_explorer,
            icon: actionIcons.Link,
          },
        ],
      );
    }

    if (subtitle && subtitleNumberOfLines === 1) {
      actions.push([
        {
          id: actionKeys.ExpandNote,
          text: loc.transactions.expand_note,
          icon: actionIcons.Note,
        },
      ]);
    }

    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.hash, subtitle, rowTitle, subtitleNumberOfLines, txMetadata]);

  return (
    <View style={styles.container}>
      <ToolTipMenu ref={menuRef} actions={toolTipActions} onPressMenuItem={onToolTipPress} onPress={onPress}>
        <ListItem
          // @ts-ignore wtf
          leftAvatar={avatar}
          title={title}
          subtitleNumberOfLines={subtitleNumberOfLines}
          subtitle={subtitle}
          Component={View}
          subtitleProps={subtitleProps}
          chevron={false}
          rightTitle={rowTitle}
          rightTitleStyle={rowTitleStyle}
          containerStyle={containerStyle}
        />
      </ToolTipMenu>
    </View>
  );
});

const actionKeys = {
  CopyTXID: 'copyTX_ID',
  CopyBlockExplorerLink: 'copy_blockExplorer',
  ExpandNote: 'expandNote',
  OpenInBlockExplorer: 'open_in_blockExplorer',
  CopyAmount: 'copyAmount',
  CopyNote: 'copyNote',
};

const actionIcons = {
  Eye: {
    iconType: 'SYSTEM',
    iconValue: 'eye',
  },
  EyeSlash: {
    iconType: 'SYSTEM',
    iconValue: 'eye.slash',
  },
  Clipboard: {
    iconType: 'SYSTEM',
    iconValue: 'doc.on.doc',
  },
  Link: {
    iconType: 'SYSTEM',
    iconValue: 'link',
  },
  Note: {
    iconType: 'SYSTEM',
    iconValue: 'note.text',
  },
};

const styles = StyleSheet.create({
  iconWidth: { width: 25 },
  container: { marginHorizontal: 4 },
});
